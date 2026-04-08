
INSERT INTO public.tenant_members (tenant_id, user_id, role)
VALUES ('32413095-dc91-4afb-be8f-e3f2e4c33e6c', '74fcf98d-c7cd-4edd-8be0-4264df8f112c', 'owner')
ON CONFLICT DO NOTHING;

UPDATE public.profiles 
SET tenant_id = '32413095-dc91-4afb-be8f-e3f2e4c33e6c' 
WHERE id = '74fcf98d-c7cd-4edd-8be0-4264df8f112c';
