import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const profileFields =
  'id, full_name, role, can_manage_inquiries, is_active, created_at';
const allowedRoles = new Set(['admin', 'staff']);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const updateFields = new Set([
  'full_name',
  'role',
  'is_active',
  'can_manage_inquiries',
]);

function logFailure(logger, operation, error) {
  const code = typeof error?.code === 'string' &&
    /^[a-z0-9_-]+$/i.test(error.code)
    ? error.code
    : 'unknown';
  logger.error(`Staff ${operation} failed.`, { code });
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateCreateBody(body) {
  if (
    !isRecord(body) ||
    Object.keys(body).some((field) => ![
      'email',
      'full_name',
      'role',
      'can_manage_inquiries',
    ].includes(field))
  ) {
    return null;
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const fullName = typeof body.full_name === 'string'
    ? body.full_name.trim()
    : '';
  const role = body.role === undefined ? 'staff' : body.role;
  const canManageInquiries = body.can_manage_inquiries === undefined
    ? false
    : body.can_manage_inquiries;

  if (
    email.length > 254 ||
    !emailPattern.test(email) ||
    fullName.length === 0 ||
    fullName.length > 120 ||
    !allowedRoles.has(role) ||
    typeof canManageInquiries !== 'boolean'
  ) {
    return null;
  }

  return {
    email: email.toLowerCase(),
    fullName,
    role,
    canManageInquiries,
  };
}

function validateUpdateBody(body) {
  if (
    !isRecord(body) ||
    Object.keys(body).length === 0 ||
    Object.keys(body).some((field) => !updateFields.has(field))
  ) {
    return null;
  }

  const update = {};
  if (Object.hasOwn(body, 'full_name')) {
    if (
      typeof body.full_name !== 'string' ||
      body.full_name.trim().length === 0 ||
      body.full_name.trim().length > 120
    ) {
      return null;
    }
    update.full_name = body.full_name.trim();
  }
  if (Object.hasOwn(body, 'role')) {
    if (!allowedRoles.has(body.role)) {
      return null;
    }
    update.role = body.role;
  }
  if (Object.hasOwn(body, 'is_active')) {
    if (typeof body.is_active !== 'boolean') {
      return null;
    }
    update.is_active = body.is_active;
  }
  if (Object.hasOwn(body, 'can_manage_inquiries')) {
    if (typeof body.can_manage_inquiries !== 'boolean') {
      return null;
    }
    update.can_manage_inquiries = body.can_manage_inquiries;
  }

  return update;
}

function profileFromRpc(data) {
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }
  return data ?? null;
}

async function removeInvitedUser(supabaseAdmin, userId, logger) {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      logFailure(logger, 'invitation rollback', error);
      return false;
    }
    return true;
  } catch (error) {
    logFailure(logger, 'invitation rollback', error);
    return false;
  }
}

export function createStaffRouter({
  supabaseAdmin,
  inviteRedirectTo = process.env.SUPABASE_AUTH_REDIRECT_URL,
  logger = console,
} = {}) {
  if (!supabaseAdmin) {
    throw new Error('A server-side Supabase admin client is required.');
  }

  const router = express.Router();
  router.use(requireAuth, requireAdmin);

  router.get('/', async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('staff_profiles')
        .select(profileFields)
        .order('created_at', { ascending: true });

      if (error) {
        logFailure(logger, 'list', error);
        return res.status(503).json({
          success: false,
          message: 'Unable to load staff accounts right now.',
        });
      }

      if (!Array.isArray(data)) {
        logger.error('Staff list returned an invalid result.');
        return res.status(503).json({
          success: false,
          message: 'Unable to load staff accounts right now.',
        });
      }

      return res.status(200).json({ success: true, data });
    } catch (error) {
      logFailure(logger, 'list', error);
      return res.status(503).json({
        success: false,
        message: 'Unable to load staff accounts right now.',
      });
    }
  });

  router.post('/', express.json(), async (req, res) => {
    const input = validateCreateBody(req.body);
    if (!input) {
      return res.status(400).json({
        success: false,
        message: 'Provide a valid email, full name, role, and inquiry permission.',
      });
    }

    if (
      typeof inviteRedirectTo !== 'string' ||
      inviteRedirectTo.trim().length === 0
    ) {
      return res.status(503).json({
        success: false,
        message: 'Staff invitation setup is incomplete. Contact an administrator.',
      });
    }

    let invitedUser;
    try {
      const { data, error } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(input.email, {
          data: { full_name: input.fullName },
          redirectTo: inviteRedirectTo,
        });
      if (error) {
        logFailure(logger, 'invitation', error);
        const duplicate = error.code === 'email_exists' ||
          error.code === 'user_already_exists' ||
          error.status === 422;
        return res.status(duplicate ? 409 : 503).json({
          success: false,
          message: duplicate
            ? 'An account already exists for that email address.'
            : 'Unable to send the staff invitation right now.',
        });
      }
      invitedUser = data?.user;
    } catch (error) {
      logFailure(logger, 'invitation', error);
      return res.status(503).json({
        success: false,
        message: 'Unable to send the staff invitation right now.',
      });
    }

    if (!invitedUser?.id) {
      logger.error('Staff invitation returned no user identifier.');
      return res.status(503).json({
        success: false,
        message: 'Unable to complete the staff invitation right now.',
      });
    }

    let profile;
    try {
      const { data, error } = await supabaseAdmin
        .from('staff_profiles')
        .upsert({
          id: invitedUser.id,
          full_name: input.fullName,
          role: input.role,
          can_manage_inquiries: input.canManageInquiries,
          is_active: true,
        }, { onConflict: 'id' })
        .select(profileFields)
        .single();

      if (error || !data) {
        if (error) {
          logFailure(logger, 'profile creation', error);
        } else {
          logger.error('Staff profile creation returned no profile.');
        }
        const rollbackSucceeded = await removeInvitedUser(
          supabaseAdmin,
          invitedUser.id,
          logger,
        );
        return res.status(503).json({
          success: false,
          message: rollbackSucceeded
            ? 'The invitation could not be completed. Please try again.'
            : 'The invitation failed and account cleanup needs administrator attention.',
        });
      }

      profile = data;
    } catch (error) {
      logFailure(logger, 'profile creation', error);
      const rollbackSucceeded = await removeInvitedUser(
        supabaseAdmin,
        invitedUser.id,
        logger,
      );
      return res.status(503).json({
        success: false,
        message: rollbackSucceeded
          ? 'The invitation could not be completed. Please try again.'
          : 'The invitation failed and account cleanup needs administrator attention.',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Staff invitation sent.',
      data: profile,
    });
  });

  router.patch('/:userId', express.json(), async (req, res) => {
    if (!uuidPattern.test(req.params.userId)) {
      return res.status(400).json({
        success: false,
        message: 'The staff account identifier is invalid.',
      });
    }

    const update = validateUpdateBody(req.body);
    if (!update) {
      return res.status(400).json({
        success: false,
        message: 'The staff account changes are invalid.',
      });
    }

    const isSelf = req.params.userId.toLowerCase() === req.user.id.toLowerCase();
    if (
      isSelf &&
      (
        Object.hasOwn(update, 'role') ||
        Object.hasOwn(update, 'can_manage_inquiries')
      )
    ) {
      return res.status(409).json({
        success: false,
        message: 'You cannot change your own role or inquiry permission.',
      });
    }
    if (isSelf && update.is_active === false) {
      return res.status(409).json({
        success: false,
        message: 'You cannot deactivate your own account.',
      });
    }

    const rpcArguments = {
      p_user_id: req.params.userId,
      p_full_name: update.full_name ?? null,
      p_role: update.role ?? null,
      p_is_active: update.is_active ?? null,
      p_can_manage_inquiries: update.can_manage_inquiries ?? null,
    };

    try {
      const { data, error } = await supabaseAdmin.rpc(
        'admin_update_staff_profile',
        rpcArguments,
      );
      if (error) {
        if (error.code === 'BW001') {
          return res.status(409).json({
            success: false,
            message: 'At least one active administrator must remain.',
          });
        }
        logFailure(logger, 'profile update', error);
        return res.status(503).json({
          success: false,
          message: 'Unable to update the staff account right now.',
        });
      }

      const profile = profileFromRpc(data);
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'The staff account was not found.',
        });
      }

      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      logFailure(logger, 'profile update', error);
      return res.status(503).json({
        success: false,
        message: 'Unable to update the staff account right now.',
      });
    }
  });

  return router;
}
