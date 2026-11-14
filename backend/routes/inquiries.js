import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';

const inquiryStatuses = new Set([
  'new',
  'in_progress',
  'waiting',
  'resolved',
  'archived',
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inquiryListFields =
  'id, name, email, phone, category, subject, status, assigned_to, created_at, updated_at';
const inquiryDetailFields =
  'id, name, email, phone, category, subject, message, status, assigned_to, created_at, updated_at';
const inquiryAssignmentFields = inquiryListFields;
const messageFields =
  'id, inquiry_id, sender_id, message_type, body, sender_email, recipient_email, created_at';
const noteFields = 'id, inquiry_id, sender_id, message_type, body, created_at';

function hasInquiryPermission(req, res, next) {
  const { role, can_manage_inquiries: canManageInquiries } =
    req.staffProfile ?? {};
  if (role !== 'admin' && !(role === 'staff' && canManageInquiries === true)) {
    return res.status(403).json({
      success: false,
      message: 'Inquiry management access is required.',
    });
  }

  return next();
}

function validateInquiryId(inquiryId) {
  return typeof inquiryId === 'string' && uuidPattern.test(inquiryId);
}

function logDatabaseFailure(logger, operation, error) {
  const code = typeof error?.code === 'string' && /^[A-Z0-9]+$/i.test(error.code)
    ? error.code
    : 'unknown';
  logger.error(`Inquiry ${operation} failed.`, { code });
}

function databaseUnavailable(res) {
  return res.status(503).json({
    success: false,
    message: 'Unable to access inquiry data right now.',
  });
}

function parsePagination(query) {
  if (
    Object.keys(query).some((key) => key !== 'page' && key !== 'limit')
  ) {
    return null;
  }

  const pageValue = query.page === undefined ? '1' : query.page;
  const limitValue = query.limit === undefined ? '20' : query.limit;
  if (
    typeof pageValue !== 'string' ||
    !/^[1-9]\d*$/.test(pageValue) ||
    typeof limitValue !== 'string' ||
    !/^[1-9]\d*$/.test(limitValue)
  ) {
    return null;
  }

  const page = Number(pageValue);
  const limit = Number(limitValue);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return null;
  }

  return { page, limit };
}

function hasOnlyFields(body, fields) {
  return body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    Object.keys(body).every((field) => fields.has(field));
}

export function createInquiriesRouter({ logger = console } = {}) {
  const router = express.Router();
  router.use(requireAuth, hasInquiryPermission);

  router.get('/', async (req, res) => {
    const pagination = parsePagination(req.query);
    if (!pagination) {
      return res.status(400).json({
        success: false,
        message: 'Pagination parameters are invalid.',
      });
    }

    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) {
      return res.status(400).json({
        success: false,
        message: 'Pagination parameters are invalid.',
      });
    }

    try {
      const supabase = req.app.locals.createAuthenticatedSupabaseClient(
        req.accessToken,
      );
      const { data, error, count } = await supabase
        .from('inquiries')
        .select(inquiryListFields, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error || !Array.isArray(data) || !Number.isSafeInteger(count)) {
        logDatabaseFailure(logger, 'list', error);
        return databaseUnavailable(res);
      }

      const assignedIds = [
        ...new Set(
          data
            .map((inquiry) => inquiry.assigned_to)
            .filter((assignedTo) => typeof assignedTo === 'string'),
        ),
      ];
      let assigneeNames = new Map();
      if (assignedIds.length > 0) {
        const { data: assignees, error: assigneeError } = await supabase
          .from('inquiry_assignee_directory')
          .select('id, full_name')
          .in('id', assignedIds);

        if (assigneeError || !Array.isArray(assignees)) {
          logDatabaseFailure(logger, 'assignee lookup', assigneeError);
          return databaseUnavailable(res);
        }

        assigneeNames = new Map(
          assignees.map((assignee) => [assignee.id, assignee.full_name]),
        );
      }

      return res.status(200).json({
        success: true,
        data: data.map((inquiry) => ({
          ...inquiry,
          assigned_to_name: inquiry.assigned_to
            ? assigneeNames.get(inquiry.assigned_to) ?? null
            : null,
        })),
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      logDatabaseFailure(logger, 'list', error);
      return databaseUnavailable(res);
    }
  });

  router.get('/:inquiryId', async (req, res) => {
    if (!validateInquiryId(req.params.inquiryId)) {
      return res.status(400).json({
        success: false,
        message: 'Inquiry ID must be a valid UUID.',
      });
    }

    try {
      const supabase = req.app.locals.createAuthenticatedSupabaseClient(
        req.accessToken,
      );
      const { data: inquiry, error: inquiryError } = await supabase
        .from('inquiries')
        .select(inquiryDetailFields)
        .eq('id', req.params.inquiryId)
        .maybeSingle();

      if (inquiryError) {
        logDatabaseFailure(logger, 'detail lookup', inquiryError);
        return databaseUnavailable(res);
      }
      if (!inquiry) {
        return res.status(404).json({
          success: false,
          message: 'Inquiry not found.',
        });
      }

      const { data: messages, error: messagesError } = await supabase
        .from('inquiry_messages')
        .select(messageFields)
        .eq('inquiry_id', req.params.inquiryId)
        .order('created_at', { ascending: true });

      if (messagesError || !Array.isArray(messages)) {
        logDatabaseFailure(logger, 'message lookup', messagesError);
        return databaseUnavailable(res);
      }

      return res.status(200).json({
        success: true,
        inquiry,
        messages,
      });
    } catch (error) {
      logDatabaseFailure(logger, 'detail lookup', error);
      return databaseUnavailable(res);
    }
  });

  router.patch(
    '/:inquiryId/status',
    express.json({ limit: '16kb' }),
    async (req, res) => {
      if (!validateInquiryId(req.params.inquiryId)) {
        return res.status(400).json({
          success: false,
          message: 'Inquiry ID must be a valid UUID.',
        });
      }
      if (
        !hasOnlyFields(req.body, new Set(['status'])) ||
        typeof req.body.status !== 'string' ||
        !inquiryStatuses.has(req.body.status)
      ) {
        return res.status(400).json({
          success: false,
          message: 'A valid inquiry status is required.',
        });
      }

      try {
        const supabase = req.app.locals.createAuthenticatedSupabaseClient(
          req.accessToken,
        );
        const { data, error } = await supabase
          .from('inquiries')
          .update({
            status: req.body.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', req.params.inquiryId)
          .select(inquiryListFields)
          .maybeSingle();

        if (error) {
          logDatabaseFailure(logger, 'status update', error);
          return databaseUnavailable(res);
        }
        if (!data) {
          return res.status(404).json({
            success: false,
            message: 'Inquiry not found.',
          });
        }

        return res.status(200).json({ success: true, inquiry: data });
      } catch (error) {
        logDatabaseFailure(logger, 'status update', error);
        return databaseUnavailable(res);
      }
    },
  );

  router.patch(
    '/:inquiryId/assignment',
    express.json({ limit: '16kb' }),
    async (req, res) => {
      if (!validateInquiryId(req.params.inquiryId)) {
        return res.status(400).json({
          success: false,
          message: 'Inquiry ID must be a valid UUID.',
        });
      }

      if (
        !hasOnlyFields(req.body, new Set(['assigned_to'])) ||
        !Object.hasOwn(req.body, 'assigned_to')
      ) {
        return res.status(400).json({
          success: false,
          message: 'A valid assignment value is required.',
        });
      }

      const { assigned_to: assignedTo } = req.body;
      if (assignedTo !== null && !validateInquiryId(assignedTo)) {
        return res.status(400).json({
          success: false,
          message: 'Assignment must be your user ID or null.',
        });
      }
      if (assignedTo !== null && assignedTo !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You may only assign inquiries to yourself.',
        });
      }

      try {
        const supabase = req.app.locals.createAuthenticatedSupabaseClient(
          req.accessToken,
        );
        let updateQuery = supabase
          .from('inquiries')
          .update({ assigned_to: assignedTo })
          .eq('id', req.params.inquiryId);

        if (assignedTo === null) {
          updateQuery = updateQuery.or(
            `assigned_to.is.null,assigned_to.eq.${req.user.id}`,
          );
        }

        const { data, error } = await updateQuery
          .select(inquiryAssignmentFields)
          .maybeSingle();

        if (error) {
          logDatabaseFailure(logger, 'assignment update', error);
          return databaseUnavailable(res);
        }
        if (!data) {
          if (assignedTo === null) {
            return res.status(409).json({
              success: false,
              message: 'This inquiry is assigned to another staff member or is no longer available to unassign.',
            });
          }

          return res.status(404).json({
            success: false,
            message: 'Inquiry not found.',
          });
        }

        return res.status(200).json({ success: true, inquiry: data });
      } catch (error) {
        logDatabaseFailure(logger, 'assignment update', error);
        return databaseUnavailable(res);
      }
    },
  );

  router.post(
    '/:inquiryId/messages',
    express.json({ limit: '16kb' }),
    async (req, res) => {
      if (!validateInquiryId(req.params.inquiryId)) {
        return res.status(400).json({
          success: false,
          message: 'Inquiry ID must be a valid UUID.',
        });
      }
      if (
        !hasOnlyFields(req.body, new Set(['body'])) ||
        typeof req.body.body !== 'string' ||
        req.body.body.trim().length === 0 ||
        req.body.body.trim().length > 10000
      ) {
        return res.status(400).json({
          success: false,
          message: 'A note between 1 and 10000 characters is required.',
        });
      }

      try {
        const supabase = req.app.locals.createAuthenticatedSupabaseClient(
          req.accessToken,
        );
        const { data, error } = await supabase
          .from('inquiry_messages')
          .insert({
            inquiry_id: req.params.inquiryId,
            sender_id: req.user.id,
            message_type: 'internal_note',
            body: req.body.body.trim(),
          })
          .select(noteFields)
          .single();

        if (error || !data) {
          logDatabaseFailure(logger, 'internal note creation', error);
          return databaseUnavailable(res);
        }

        return res.status(201).json({ success: true, message: data });
      } catch (error) {
        logDatabaseFailure(logger, 'internal note creation', error);
        return databaseUnavailable(res);
      }
    },
  );

  return router;
}

export default createInquiriesRouter;
