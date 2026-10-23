"""
Meta Adapter (Facebook Graph API & Instagram Graph API)
Handles posting, comment moderation, DM responses, and metrics.
"""

from typing import Dict, Any, List, Optional
import httpx


class MetaAdapter:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.base_url = "https://graph.facebook.com/v20.0"

    async def publish_facebook_post(self, page_id: str, message: str, media_url: Optional[str] = None) -> Dict[str, Any]:
        """Publishes post or photo to Facebook Page"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            if media_url:
                url = f"{self.base_url}/{page_id}/photos"
                payload = {"caption": message, "url": media_url}
            else:
                url = f"{self.base_url}/{page_id}/feed"
                payload = {"message": message}

            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code in (200, 201):
                return resp.json()
            return {"error": resp.text, "status_code": resp.status_code}

    async def publish_instagram_media(self, ig_user_id: str, image_url: str, caption: str) -> Dict[str, Any]:
        """Creates container and publishes to Instagram feed"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            # Step 1: Create container
            c_url = f"{self.base_url}/{ig_user_id}/media"
            c_resp = await client.post(c_url, headers=headers, json={"image_url": image_url, "caption": caption})
            if c_resp.status_code not in (200, 201):
                return {"error": f"Container creation failed: {c_resp.text}"}

            container_id = c_resp.json().get("id")

            # Step 2: Publish media
            p_url = f"{self.base_url}/{ig_user_id}/media_publish"
            p_resp = await client.post(p_url, headers=headers, json={"creation_id": container_id})
            return p_resp.json()

    async def reply_to_comment(self, comment_id: str, message: str) -> Dict[str, Any]:
        """Replies to a user comment on Facebook or Instagram"""
        async with httpx.AsyncClient(timeout=20.0) as client:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            url = f"{self.base_url}/{comment_id}/comments"
            resp = await client.post(url, headers=headers, json={"message": message})
            return resp.json()

    async def delete_comment(self, comment_id: str) -> bool:
        """Moderates / deletes spam comments"""
        async with httpx.AsyncClient(timeout=15.0) as client:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            url = f"{self.base_url}/{comment_id}"
            resp = await client.delete(url, headers=headers)
            return resp.status_code == 200
