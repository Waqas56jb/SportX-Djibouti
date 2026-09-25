import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { ok } from '../../utils/apiResponse.js';
import { badRequest } from '../../utils/errors.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { imageUpload } from '../../middleware/upload.middleware.js';
import { storageService } from '../../services/storage/storage.service.js';
import { adminSettings, notificationPreferences, paymentSettings, preferencesBody, savePreferences, setLogo, settingsBody, updateSettings } from './settings.admin.service.js';

/** /api/v1/admin/settings */
export const adminSettingsRouter = Router();

// GET/PATCH /settings, with /settings/store (GET, PATCH, PUT) as the admin UI's alias.
for (const path of ['/', '/store']) {
  adminSettingsRouter.get(path, requirePermission('settings:view'), asyncHandler(async (_req, res) => ok(res, await adminSettings())));
  for (const method of ['patch', 'put'] as const) {
    adminSettingsRouter[method](
      path,
      requirePermission('settings:edit'),
      validate({ body: settingsBody }),
      asyncHandler(async (req, res) => ok(res, await updateSettings(req, req.body), 'Settings saved.')),
    );
  }
}

adminSettingsRouter.post(
  '/logo',
  requirePermission('settings:edit'),
  imageUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Attach an image in the "file" field.');
    const stored = await storageService.putImage('store', 'logo', req.file);
    try {
      return ok(res, await setLogo(req, stored.url), 'Logo updated.');
    } catch (err) {
      await storageService.remove(stored.path);
      throw err;
    }
  }),
);

adminSettingsRouter.get('/notifications', requirePermission('settings:view'), asyncHandler(async (_req, res) => ok(res, await notificationPreferences())));
for (const method of ['put', 'patch'] as const) {
  adminSettingsRouter[method](
    '/notifications',
    requirePermission('settings:edit'),
    validate({ body: preferencesBody }),
    asyncHandler(async (req, res) => ok(res, await savePreferences(req, req.body), 'Notification settings saved.')),
  );
}

/** Read-only provider status. Secrets are never returned (only whether they are configured). */
adminSettingsRouter.get('/payments', requirePermission('settings:view'), asyncHandler(async (_req, res) => ok(res, paymentSettings())));
