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
  'id, name, email, phone, category, subject, status, assigned_to, follow_up_at, follow_up_note, created_at, updated_at';
const inquiryDetailFields =
  'id, name, email, phone, category, subject, message, status, assigned_to, follow_up_at, follow_up_note, created_at, updated_at';
const messageFields =
  'id, inquiry_id, sender_id, message_type, body, sender_email, recipient_email, created_at';
const noteFields = 'id, inquiry_id, sender_id, message_type, body, created_at';
const activityFields =
  'id, inquiry_id, actor_user_id, actor_name, activity_type, previous_value, new_value, created_at';
const inquirySorts = new Map([
  ['newest', { field: 'created_at', ascending: false }],
  ['oldest', { field: 'created_at', ascending: true }],
  ['recently_updated', { field: 'updated_at', ascending: false }],
  ['oldest_updated', { field: 'updated_at', ascending: true }],
]);

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

function parseInquiryQuery(query) {
  const allowedFields = new Set([
    'page',
    'limit',
    'search',
    'status',
    'category',
    'assigned_to',
    'sort',
  ]);
  if (
    Object.keys(query).some((key) => !allowedFields.has(key))
  ) {
    return null;
  }

  const pageValue = query.page === undefined ? '1' : query.page;
  const limitValue = query.limit === undefined ? '20' : query.limit;
  const searchValue = query.search === undefined ? '' : query.search;
  if (typeof searchValue !== 'string') {
    return null;
  }
  const search = searchValue.trim();
  const status = query.status;
  const category = query.category;
  const assignedTo = query.assigned_to;
  const sort = query.sort === undefined ? 'newest' : query.sort;
  if (
    typeof pageValue !== 'string' ||
    !/^[1-9]\d*$/.test(pageValue) ||
    typeof limitValue !== 'string' ||
    !/^[1-9]\d*$/.test(limitValue)
  ) {
    return null;
  }
  if (
    search.length > 100 ||
    (status !== undefined && !inquiryStatuses.has(status)) ||
    (
      category !== undefined &&
      (
        typeof category !== 'string' ||
        category.trim().length === 0 ||
        category.length > 80
      )
    ) ||
    (
      assignedTo !== undefined &&
      assignedTo !== 'unassigned' &&
      !validateInquiryId(assignedTo)
    ) ||
    typeof sort !== 'string' ||
    !inquirySorts.has(sort)
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

  return {
    page,
    limit,
    search,
    status,
    category: category?.trim(),
    assignedTo,
    sort,
  };
}

function escapePostgrestValue(value) {
  return `"*${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}*"`;
}

function applyInquiryFilters(query, filters) {
  let filteredQuery = query;
  if (filters.search) {
    if (validateInquiryId(filters.search)) {
      filteredQuery = filteredQuery.eq('id', filters.search);
    } else {
      const value = escapePostgrestValue(filters.search);
      filteredQuery = filteredQuery.or(
        `name.ilike.${value},email.ilike.${value},subject.ilike.${value}`,
      );
    }
  }
  if (filters.status) {
    filteredQuery = filteredQuery.eq('status', filters.status);
  }
  if (filters.category) {
    filteredQuery = filteredQuery.eq('category', filters.category);
  }
  if (filters.assignedTo === 'unassigned') {
    filteredQuery = filteredQuery.is('assigned_to', null);
  } else if (filters.assignedTo) {
    filteredQuery = filteredQuery.eq('assigned_to', filters.assignedTo);
  }
  return filteredQuery;
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
    const filters = parseInquiryQuery(req.query);
    if (!filters) {
      return res.status(400).json({
        success: false,
        message: 'Inquiry query parameters are invalid.',
      });
    }

    const { page, limit, sort } = filters;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) {
      return res.status(400).json({
        success: false,
        message: 'Inquiry query parameters are invalid.',
      });
    }

    try {
      const supabase = req.app.locals.createAuthenticatedSupabaseClient(
        req.accessToken,
      );
      let listQuery = supabase
        .from('inquiries')
        .select(inquiryListFields, { count: 'exact' });
      listQuery = applyInquiryFilters(listQuery, filters);
      const ordering = inquirySorts.get(sort);
      const { data, error, count } = await listQuery
        .order(ordering.field, { ascending: ordering.ascending })
        .order('id', { ascending: false })
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

  router.get('/summary', async (req, res) => {
    try {
      const supabase = req.app.locals.createAuthenticatedSupabaseClient(
        req.accessToken,
      );
      const [totalResult, ...statusResults] = await Promise.all([
        supabase
          .from('inquiries')
          .select('id', { count: 'exact', head: true }),
        ...[...inquiryStatuses].map((status) =>
          supabase
            .from('inquiries')
            .select('id', { count: 'exact', head: true })
            .eq('status', status)
        ),
      ]);
      const results = [totalResult, ...statusResults];
      const failedResult = results.find(({ count, error }) =>
        error || !Number.isSafeInteger(count) || count < 0
      );
      if (failedResult) {
        logDatabaseFailure(logger, 'summary lookup', failedResult.error);
        return databaseUnavailable(res);
      }

      const counts = Object.fromEntries(
        [...inquiryStatuses].map((status, index) => [
          status,
          statusResults[index].count,
        ]),
      );
      return res.status(200).json({
        success: true,
        data: { total: totalResult.count, ...counts },
      });
    } catch (error) {
      logDatabaseFailure(logger, 'summary lookup', error);
      return databaseUnavailable(res);
    }
  });

  router.get('/assignees', async (req, res) => {
    try {
      const supabase = req.app.locals.createAuthenticatedSupabaseClient(
        req.accessToken,
      );
      const { data, error } = await supabase
        .from('inquiry_assignee_directory')
        .select('id, full_name')
        .order('full_name', { ascending: true });

      if (error || !Array.isArray(data)) {
        logDatabaseFailure(logger, 'assignee options lookup', error);
        return databaseUnavailable(res);
      }

      return res.status(200).json({ success: true, data });
    } catch (error) {
      logDatabaseFailure(logger, 'assignee options lookup', error);
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

      const { data: activities, error: activitiesError } = await supabase
        .from('inquiry_activity')
        .select(activityFields)
        .eq('inquiry_id', req.params.inquiryId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (activitiesError || !Array.isArray(activities)) {
        logDatabaseFailure(logger, 'activity lookup', activitiesError);
        return databaseUnavailable(res);
      }

      return res.status(200).json({
        success: true,
        inquiry,
        messages,
        activities,
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
        !hasOnlyFields(
          req.body,
          new Set(['assigned_to', 'expected_assigned_to']),
        ) ||
        !Object.hasOwn(req.body, 'assigned_to') ||
        !Object.hasOwn(req.body, 'expected_assigned_to')
      ) {
        return res.status(400).json({
          success: false,
          message: 'A valid assignment and current assignment are required.',
        });
      }

      const { assigned_to: assignedTo } = req.body;
      if (assignedTo !== null && !validateInquiryId(assignedTo)) {
        return res.status(400).json({
          success: false,
          message: 'Assignment must be an active staff user ID or null.',
        });
      }
      const { expected_assigned_to: expectedAssignedTo } = req.body;
      if (
        expectedAssignedTo !== null &&
        !validateInquiryId(expectedAssignedTo)
      ) {
        return res.status(400).json({
          success: false,
          message: 'The current assignment is invalid.',
        });
      }

      try {
        const supabase = req.app.locals.createAuthenticatedSupabaseClient(
          req.accessToken,
        );
        const { data: assignmentResult, error } = await supabase.rpc(
          'admin_assign_inquiry',
          {
            p_inquiry_id: req.params.inquiryId,
            p_assigned_to: assignedTo,
            p_expected_assigned_to: expectedAssignedTo,
          },
        );

        if (error) {
          if (error.code === 'BW002') {
            return res.status(409).json({
              success: false,
              message: 'The inquiry assignment changed. Refresh and try again.',
            });
          }
          if (error.code === 'BW003') {
            return res.status(400).json({
              success: false,
              message: 'Choose an active staff member for this assignment.',
            });
          }
          if (error.code === 'P0002') {
            return res.status(404).json({
              success: false,
              message: 'Inquiry not found.',
            });
          }
          if (error.code === '42501') {
            return res.status(403).json({
              success: false,
              message: 'Inquiry management access is required.',
            });
          }
          logDatabaseFailure(logger, 'assignment update', error);
          return databaseUnavailable(res);
        }
        const data = Array.isArray(assignmentResult)
          ? assignmentResult[0]
          : assignmentResult;
        if (!data) {
          return res.status(404).json({
            success: false,
            message: 'Inquiry not found.',
          });
        }

        return res.status(200).json({
          success: true,
          inquiry: {
            id: data.id,
            assigned_to: data.assigned_to,
            updated_at: data.updated_at,
          },
        });
      } catch (error) {
        logDatabaseFailure(logger, 'assignment update', error);
        return databaseUnavailable(res);
      }
    },
  );

  router.patch(
    '/:inquiryId/follow-up',
    express.json({ limit: '16kb' }),
    async (req, res) => {
      if (!validateInquiryId(req.params.inquiryId)) {
        return res.status(400).json({
          success: false,
          message: 'Inquiry ID must be a valid UUID.',
        });
      }
      if (
        !hasOnlyFields(req.body, new Set(['follow_up_at', 'follow_up_note'])) ||
        !Object.hasOwn(req.body, 'follow_up_at') ||
        !Object.hasOwn(req.body, 'follow_up_note')
      ) {
        return res.status(400).json({
          success: false,
          message: 'A follow-up date and note are required.',
        });
      }

      const { follow_up_at: followUpAt, follow_up_note: followUpNote } = req.body;
      const validDate = followUpAt === null ||
        (
          typeof followUpAt === 'string' &&
          /(?:Z|[+-]\d{2}:\d{2})$/i.test(followUpAt) &&
          Number.isFinite(Date.parse(followUpAt))
        );
      const normalizedNote = typeof followUpNote === 'string'
        ? followUpNote.trim()
        : followUpNote;
      if (
        !validDate ||
        (
          normalizedNote !== null &&
          (
            typeof normalizedNote !== 'string' ||
            normalizedNote.length === 0 ||
            normalizedNote.length > 500
          )
        ) ||
        (followUpAt === null && normalizedNote !== null) ||
        (followUpAt !== null && normalizedNote === null)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Provide a valid follow-up date and a note of up to 500 characters, or clear both.',
        });
      }

      try {
        const supabase = req.app.locals.createAuthenticatedSupabaseClient(
          req.accessToken,
        );
        const { data: updateResult, error } = await supabase.rpc(
          'admin_update_inquiry_follow_up',
          {
            p_inquiry_id: req.params.inquiryId,
            p_follow_up_at: followUpAt,
            p_follow_up_note: normalizedNote,
          },
        );

        if (error) {
          if (error.code === '42501') {
            return res.status(403).json({
              success: false,
              message: 'Inquiry management access is required.',
            });
          }
          if (error.code === '22023') {
            return res.status(400).json({
              success: false,
              message: 'Provide a valid follow-up date and note, or clear both.',
            });
          }
          if (error.code === 'P0002') {
            return res.status(404).json({
              success: false,
              message: 'Inquiry not found.',
            });
          }
          logDatabaseFailure(logger, 'follow-up update', error);
          return databaseUnavailable(res);
        }
        const data = Array.isArray(updateResult)
          ? updateResult[0]
          : updateResult;
        if (!data) {
          return res.status(404).json({
            success: false,
            message: 'Inquiry not found.',
          });
        }

        return res.status(200).json({
          success: true,
          inquiry: {
            id: data.id,
            follow_up_at: data.follow_up_at,
            follow_up_note: data.follow_up_note,
            updated_at: data.updated_at,
          },
        });
      } catch (error) {
        logDatabaseFailure(logger, 'follow-up update', error);
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
