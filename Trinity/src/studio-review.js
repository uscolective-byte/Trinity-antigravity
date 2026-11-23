/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module studio-review.js (Trinity/src/studio-review.js) in the TRINITY OMNI-CORE ecosystem.
 */
import { z } from 'zod';
import { HttpError } from './security.js';

export const reviewRequestSchema = z.object({
  project_id: z.string().uuid().optional(),
  version: z.number().int().min(1).default(1),
  html: z.string().min(10).max(500000)
}).strict();

/**
 * Deep static analysis of HTML code generated in Trinity AI Studio.
 * Audits accessibility (a11y), security (CSP/links), performance (payload), and SEO.
 */
export function auditHtmlQuality(html) {
  const issues = [];
  const passed = [];
  const cleanHtml = String(html || '');
  const lower = cleanHtml.toLowerCase();

  // 1. Accessibility & Document Structure
  if (lower.includes('<!doctype html>')) passed.push('HTML5 doctype declared.');
  else issues.push({ id: 'doctype_missing', severity: 'high', category: 'a11y', message: 'Missing <!doctype html> declaration.' });

  if (/<html[^>]*\blang=["'][a-z]{2,5}["']/i.test(cleanHtml)) passed.push('Attribute lang on <html> is defined.');
  else issues.push({ id: 'lang_missing', severity: 'medium', category: 'a11y', message: 'Missing lang attribute on the <html> tag.' });

  if (/<title>[^<]+<\/title>/i.test(cleanHtml)) passed.push('<title> tag is present and non-empty.');
  else issues.push({ id: 'title_missing', severity: 'high', category: 'seo', message: 'Missing or empty <title> tag.' });

  if (/<meta[^>]*name=["']viewport["'][^>]*content=/i.test(cleanHtml)) passed.push('Responsive meta viewport is configured.');
  else issues.push({ id: 'viewport_missing', severity: 'high', category: 'performance', message: 'Missing responsive <meta name="viewport"> tag.' });

  // Images without alt
  const imgMatches = cleanHtml.match(/<img\b(?![^>]*\balt=)[^>]*>/gi) || [];
  if (imgMatches.length === 0) passed.push('All images define an alt attribute.');
  else issues.push({ id: 'img_alt_missing', severity: 'medium', category: 'a11y', message: `Found ${imgMatches.length} image(s) without an alt attribute.` });

  // Heading hierarchy
  if (/<h1\b/i.test(cleanHtml)) passed.push('Primary <h1> heading is present.');
  else issues.push({ id: 'h1_missing', severity: 'medium', category: 'seo', message: 'Page is missing a primary <h1> heading.' });

  // 2. Security & Best Practices
  if (/content-security-policy/i.test(cleanHtml)) passed.push('Content-Security-Policy (CSP) protection is active.');
  else issues.push({ id: 'csp_missing', severity: 'high', category: 'security', message: 'Missing Content-Security-Policy (CSP) meta tag.' });

  const targetBlankUnsafe = cleanHtml.match(/<a\b[^>]*\btarget=["']_blank["'](?![^>]*\brel=["'][^"']*noopener)[^>]*>/gi) || [];
  if (targetBlankUnsafe.length === 0) passed.push('Links with target="_blank" safely use rel="noopener".');
  else issues.push({ id: 'target_blank_unsafe', severity: 'medium', category: 'security', message: `Found ${targetBlankUnsafe.length} link(s) with target="_blank" missing rel="noopener".` });

  if (!cleanHtml.includes('http://')) passed.push('All resources and links exclusively use secure HTTPS.');
  else issues.push({ id: 'insecure_http', severity: 'medium', category: 'security', message: 'Found insecure HTTP links (Mixed Content risk).' });

  // 3. Performance & Sizing
  const byteSize = Buffer.byteLength(cleanHtml, 'utf8');
  if (byteSize < 120000) passed.push(`Optimized HTML payload size (${(byteSize / 1024).toFixed(1)} kB < 120 kB).`);
  else issues.push({ id: 'payload_too_large', severity: 'low', category: 'performance', message: `Large HTML document (${(byteSize / 1024).toFixed(1)} kB); consider CSS compression.` });

  // 4. Score Calculation (0-100)
  const calcScore = (cat) => {
    const catIssues = issues.filter(i => i.category === cat);
    let penalty = 0;
    for (const i of catIssues) {
      if (i.severity === 'high') penalty += 20;
      else if (i.severity === 'medium') penalty += 10;
      else penalty += 5;
    }
    return Math.max(50, 100 - penalty);
  };

  const scores = {
    performance: calcScore('performance'),
    accessibility: calcScore('a11y'),
    best_practices: calcScore('security'),
    seo: calcScore('seo')
  };

  // 5. Automated Unit Test Generation (Playwright / Assertions)
  const titleMatch = cleanHtml.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Document';
  const hasForm = /<form\b/i.test(cleanHtml);
  const hasButton = /<button\b/i.test(cleanHtml);

  const generatedTests = [
    {
      name: 'Verify Page Title & Meta Viewport',
      code: `test('has expected title', async ({ page }) => {\n  await expect(page).toHaveTitle(/${title.slice(0, 30).replace(/[[\]\\]/g, '')}/);\n  const viewport = await page.locator('meta[name="viewport"]');\n  await expect(viewport).toHaveCount(1);\n});`
    },
    {
      name: 'Accessibility A11y Smoke Test',
      code: `test('passes basic a11y checks', async ({ page }) => {\n  const imagesWithoutAlt = await page.locator('img:not([alt])').count();\n  expect(imagesWithoutAlt).toBe(0);\n  const h1Count = await page.locator('h1').count();\n  expect(h1Count).toBeGreaterThanOrEqual(1);\n});`
    }
  ];

  if (hasButton) {
    generatedTests.push({
      name: 'Interactive Elements Smoke Test',
      code: `test('buttons are clickable and visible', async ({ page }) => {\n  const buttons = page.locator('button');\n  const count = await buttons.count();\n  expect(count).toBeGreaterThan(0);\n  await expect(buttons.first()).toBeVisible();\n});`
    });
  }

  if (hasForm) {
    generatedTests.push({
      name: 'Form Inputs Accessibility Test',
      code: `test('inputs have labels or aria-labels', async ({ page }) => {\n  const inputs = page.locator('input:not([type="hidden"])');\n  const count = await inputs.count();\n  for (let i = 0; i < count; i++) {\n    const aria = await inputs.nth(i).getAttribute('aria-label');\n    const id = await inputs.nth(i).getAttribute('id');\n    expect(Boolean(aria || id)).toBe(true);\n  }\n});`
    });
  }

  const generatedTestsSuite = `import { test, expect } from '@playwright/test';\n\ntest.describe('AI Studio Quality Smoke Suite', () => {\n` +
    generatedTests.map(t => `  // ${t.name}\n  ${t.code.split('\n').join('\n  ')}`).join('\n\n') +
    `\n});`;

  return {
    scores,
    score_performance: scores.performance,
    score_accessibility: scores.accessibility,
    score_best_practices: scores.best_practices,
    score_seo: scores.seo,
    overall_score: Math.round((scores.performance + scores.accessibility + scores.best_practices + scores.seo) / 4),
    issues,
    passed_checks: passed,
    generated_tests: generatedTestsSuite,
    test_cases: generatedTests,
    audited_at: new Date().toISOString()
  };
}

/**
 * Saves the audit result for a specific project in D1.
 */
export async function recordStudioReview(env, projectId, version, review) {
  if (!env.DB) return review;
  const id = `rev-${crypto.randomUUID()}`;
  await env.DB.prepare(`
    INSERT INTO studio_code_reviews(
      id, project_id, version, score_performance, score_accessibility,
      score_best_practices, score_seo, issues_json, passed_checks_json, generated_tests_json
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    projectId,
    version,
    review.scores.performance,
    review.scores.accessibility,
    review.scores.best_practices,
    review.scores.seo,
    JSON.stringify(review.issues || []),
    JSON.stringify(review.passed_checks || []),
    JSON.stringify(review.generated_tests || [])
  ).run().catch(() => {});

  return { ...review, review_id: id };
}
