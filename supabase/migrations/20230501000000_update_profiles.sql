-- Update the profiles table to include additional fields
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS designation TEXT,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create a function to sync email from auth.users to profiles
CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to sync email when a user is updated
CREATE OR REPLACE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION sync_user_email();

-- Create a trigger to sync email when a user is created
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_email();
