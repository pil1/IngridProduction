CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_token text)
RETURNS boolean
LANGUAGE PLPGSQL
SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  invitation_record public.invitations%ROWTYPE;
  current_user_id UUID;
  current_user_role TEXT; -- Added to fetch current user's role
BEGIN
  -- Get the current authenticated user's ID
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found. Please sign in or sign up first.';
  END IF;

  -- Get the current user's role
  SELECT role INTO current_user_role FROM public.profiles WHERE id = current_user_id;

  -- Guardrail: Prevent super-admins from accepting invitations
  IF current_user_role = 'super-admin' THEN
    RAISE EXCEPTION 'Super-admins cannot accept company invitations as they are not tied to a specific company.';
  END IF;

  -- Find the invitation by token
  SELECT * INTO invitation_record
  FROM public.invitations
  WHERE token = invitation_token;

  -- Check if invitation exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or invalid.';
  END IF;

  -- Check if invitation is already accepted
  IF invitation_record.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has already been accepted.';
  END IF;

  -- Check if invitation has expired
  IF invitation_record.expires_at < NOW() THEN
    RAISE EXCEPTION 'Invitation has expired.';
  END IF;

  -- Update the user's profile with company_id and role from the invitation
  UPDATE public.profiles
  SET
    company_id = invitation_record.company_id,
    role = invitation_record.role,
    updated_at = NOW()
  WHERE id = current_user_id;

  -- Mark the invitation as accepted
  UPDATE public.invitations
  SET
    accepted_at = NOW(),
    expires_at = NOW() -- Expire it immediately after acceptance
  WHERE id = invitation_record.id;

  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error accepting invitation: %', SQLERRM;
    RETURN FALSE;
END;
$$;