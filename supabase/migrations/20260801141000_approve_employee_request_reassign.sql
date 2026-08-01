-- Excusal approve may optionally reassign the task in the same transaction.
DROP FUNCTION IF EXISTS public.approve_employee_request(uuid, uuid);

CREATE OR REPLACE FUNCTION public.approve_employee_request(
  p_request_id uuid,
  p_reviewer_id uuid,
  p_new_assignee uuid DEFAULT NULL
)
RETURNS public.employee_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.employee_requests%ROWTYPE;
  v_task public.tasks%ROWTYPE;
  v_old_due date;
  v_old_assignee uuid;
BEGIN
  SELECT *
  INTO v_request
  FROM public.employee_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPLOYEE_REQUEST_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'EMPLOYEE_REQUEST_NOT_PENDING'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_task
  FROM public.tasks
  WHERE id = v_request.task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.type = 'extension' THEN
    IF v_request.requested_date IS NULL THEN
      RAISE EXCEPTION 'EXTENSION_DATE_REQUIRED'
        USING ERRCODE = 'P0001';
    END IF;

    v_old_due := v_task.due_date;

    UPDATE public.tasks
    SET due_date = v_request.requested_date
    WHERE id = v_task.id;

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      p_reviewer_id,
      'task.updated',
      'task',
      v_task.id,
      jsonb_build_object(
        'source', 'employee_request_extension',
        'requestId', v_request.id,
        'fields', jsonb_build_object(
          'due_date', jsonb_build_object(
            'from', to_jsonb(v_old_due),
            'to', to_jsonb(v_request.requested_date)
          )
        )
      )
    );
  ELSIF v_request.type = 'excusal' THEN
    v_old_assignee := v_task.assigned_to;

    IF v_task.assigned_to IS NOT DISTINCT FROM v_request.user_id THEN
      UPDATE public.tasks
      SET assigned_to = p_new_assignee
      WHERE id = v_task.id;

      INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
      VALUES (
        p_reviewer_id,
        'task.assigned',
        'task',
        v_task.id,
        jsonb_build_object(
          'source', 'employee_request_excusal',
          'requestId', v_request.id,
          'fromUserId', v_old_assignee,
          'toUserId', p_new_assignee
        )
      );
    END IF;
  ELSE
    RAISE EXCEPTION 'INVALID_EMPLOYEE_REQUEST_TYPE'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.employee_requests
  SET
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = timezone('utc', now()),
    rejection_reason = NULL
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_employee_request(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_employee_request(uuid, uuid, uuid) TO service_role;
