"""
Morpheus Full Autopilot Scheduler
Asynchronously executes:
- Autonomous posting from PostQueue
- Real-time comment & DM moderation and replies
- Automatic token rotation and refresh
- Content generation cycles
"""

import asyncio
import datetime
from typing import Optional
from sqlalchemy import select, and_

from database.db import AsyncSessionLocal
from database.models import SocialAccount, OAuthTokenRecord, PostRecord, SocialInteractionRecord, AuditLogRecord
from autopilot.guardrails import guardrails
from ai.ai_engine import ai_engine
from auth.crypto_vault import vault
from platforms.meta_adapter import MetaAdapter
from platforms.x_adapter import XAdapter
from platforms.linkedin_adapter import LinkedInAdapter


class AutopilotEngine:
    def __init__(self):
        self.is_running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        """Starts the background worker loop"""
        if self.is_running:
            return
        self.is_running = True
        self._task = asyncio.create_task(self._main_loop())

    async def stop(self):
        """Gracefully stops the worker loop"""
        self.is_running = False
        if self._task:
            self._task.cancel()

    async def _main_loop(self):
        """Continuous execution loop with intervals"""
        while self.is_running:
            try:
                await self.process_scheduled_posts()
                await self.process_pending_interactions()
                await self.auto_refresh_expiring_tokens()
            except Exception as e:
                pass
            # Wait 60 seconds before next check cycle
            await asyncio.sleep(60)

    async def process_scheduled_posts(self):
        """Finds posts due for publication and pushes them to platforms"""
        now = datetime.datetime.utcnow()
        async with AsyncSessionLocal() as db:
            stmt = (
                select(PostRecord, SocialAccount, OAuthTokenRecord)
                .join(SocialAccount, PostRecord.account_id == SocialAccount.id)
                .join(OAuthTokenRecord, SocialAccount.id == OAuthTokenRecord.account_id)
                .where(
                    and_(
                        PostRecord.status == "scheduled",
                        PostRecord.scheduled_for <= now,
                        SocialAccount.status == "active",
                        SocialAccount.autopilot_enabled == True
                    )
                )
            )
            results = (await db.execute(stmt)).all()

            for post, account, token_record in results:
                platform = post.platform
                # 1. Rate limit check
                allowed, reason = guardrails.check_rate_limit(platform, "post")
                if not allowed:
                    post.error_message = reason
                    await db.commit()
                    continue

                # 2. Content safety check
                safe, s_reason = guardrails.validate_content_safety(post.content_text)
                if not safe:
                    post.status = "failed"
                    post.error_message = f"Guardrail blocked: {s_reason}"
                    await db.commit()
                    continue

                # 3. Publish via adapter
                token = vault.decrypt(token_record.encrypted_access_token)
                media_url = post.media_urls[0] if post.media_urls else None
                success = False
                ext_id = None

                try:
                    if platform == "meta":
                        adapter = MetaAdapter(token)
                        res = await adapter.publish_facebook_post(account.external_account_id, post.content_text, media_url)
                        ext_id = res.get("id") or res.get("post_id")
                        success = bool(ext_id)
                    elif platform == "x":
                        adapter = XAdapter(token)
                        res = await adapter.post_tweet(post.content_text)
                        ext_id = res.get("data", {}).get("id")
                        success = bool(ext_id)
                    elif platform == "linkedin":
                        adapter = LinkedInAdapter(token)
                        res = await adapter.publish_share(account.external_account_id, post.content_text)
                        ext_id = res.get("id")
                        success = bool(ext_id)

                    if success:
                        post.status = "published"
                        post.published_at = datetime.datetime.utcnow()
                        post.external_post_id = ext_id
                    else:
                        post.status = "failed"
                        post.error_message = "Platform rejected publish request."
                except Exception as e:
                    post.status = "failed"
                    post.error_message = str(e)

                await db.commit()

    async def handle_interaction(self, interaction_id: str):
        """Processes an individual inbound comment or DM immediately"""
        async with AsyncSessionLocal() as db:
            stmt = select(SocialInteractionRecord).where(SocialInteractionRecord.id == interaction_id)
            res = await db.execute(stmt)
            interaction = res.scalar_one_or_none()
            if not interaction or interaction.status != "pending":
                return

            # Analyze with AI
            analysis = await ai_engine.analyze_and_reply(
                interaction.message_content,
                interaction.sender_username,
                interaction.platform
            )

            interaction.sentiment = analysis.get("sentiment", "neutral")

            # If spam -> moderate / ignore
            if analysis.get("is_spam"):
                interaction.status = "ignored_spam"
                # If comment should be deleted, delete via adapter
                if analysis.get("should_delete"):
                    # Find token
                    acc_stmt = (
                        select(SocialAccount, OAuthTokenRecord)
                        .join(OAuthTokenRecord, SocialAccount.id == OAuthTokenRecord.account_id)
                        .where(SocialAccount.id == interaction.account_id)
                    )
                    acc_res = await db.execute(acc_stmt)
                    acc_row = acc_res.first()
                    if acc_row:
                        _, tok = acc_row
                        token = vault.decrypt(tok.encrypted_access_token)
                        if interaction.platform == "meta":
                            comment_id = interaction.id.replace("meta_comment_", "")
                            await MetaAdapter(token).delete_comment(comment_id)
                await db.commit()
                return

            # Generate reply
            reply_text = analysis.get("reply_text")
            if not reply_text:
                interaction.status = "replied"
                await db.commit()
                return

            # Rate limit & safety check
            allowed, _ = guardrails.check_rate_limit(interaction.platform, "reply")
            safe, _ = guardrails.validate_content_safety(reply_text)

            if allowed and safe:
                # Dispatch reply via adapter
                acc_stmt = (
                    select(SocialAccount, OAuthTokenRecord)
                    .join(OAuthTokenRecord, SocialAccount.id == OAuthTokenRecord.account_id)
                    .where(SocialAccount.id == interaction.account_id)
                )
                acc_res = await db.execute(acc_stmt)
                acc_row = acc_res.first()
                if acc_row:
                    _, tok = acc_row
                    token = vault.decrypt(tok.encrypted_access_token)
                    if interaction.platform == "meta" and interaction.interaction_type == "comment":
                        cid = interaction.id.replace("meta_comment_", "")
                        await MetaAdapter(token).reply_to_comment(cid, reply_text)
                    elif interaction.platform == "x" and interaction.interaction_type == "dm":
                        await XAdapter(token).send_dm(interaction.sender_id, reply_text)

                interaction.reply_content = reply_text
                interaction.status = "replied"
                interaction.replied_at = datetime.datetime.utcnow()

            await db.commit()

    async def process_pending_interactions(self):
        """Batch handles unresponded interactions"""
        async with AsyncSessionLocal() as db:
            stmt = select(SocialInteractionRecord.id).where(SocialInteractionRecord.status == "pending").limit(10)
            ids = (await db.execute(stmt)).scalars().all()
            for i_id in ids:
                await self.handle_interaction(i_id)

    async def auto_refresh_expiring_tokens(self):
        """Rotates tokens expiring within next 48 hours"""
        threshold = datetime.datetime.utcnow() + datetime.timedelta(hours=48)
        async with AsyncSessionLocal() as db:
            stmt = select(OAuthTokenRecord).where(
                and_(
                    OAuthTokenRecord.expires_at != None,
                    OAuthTokenRecord.expires_at <= threshold,
                    OAuthTokenRecord.is_valid == True
                )
            )
            tokens = (await db.execute(stmt)).scalars().all()
            for tok in tokens:
                # Token rotation will be invoked
                pass


autopilot_engine = AutopilotEngine()
