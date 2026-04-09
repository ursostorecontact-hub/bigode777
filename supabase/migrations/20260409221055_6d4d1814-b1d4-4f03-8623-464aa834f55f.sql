-- Assign all unassigned chats from instance 48fca2e2 to Evelyn (100% distribution)
UPDATE public.whatsapp_chats 
SET assigned_to = 'c1b82ea2-9afa-42a7-85ef-9bbc1eab1db6'
WHERE whatsapp_instance_id = '48fca2e2-14ce-4fc2-9b1d-5fb32e7f79d7'
AND assigned_to IS NULL;