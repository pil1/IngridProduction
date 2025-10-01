-- Migration: Add avatar positioning support
-- Description: Add fields to store avatar crop/positioning data for profile circles

-- Add positioning fields to user_avatars table
ALTER TABLE user_avatars ADD COLUMN IF NOT EXISTS position_x DECIMAL(5,3) DEFAULT 0.5;
ALTER TABLE user_avatars ADD COLUMN IF NOT EXISTS position_y DECIMAL(5,3) DEFAULT 0.5;
ALTER TABLE user_avatars ADD COLUMN IF NOT EXISTS zoom_level DECIMAL(4,2) DEFAULT 1.0;

-- Add constraints for positioning values
ALTER TABLE user_avatars ADD CONSTRAINT check_position_x CHECK (position_x >= 0 AND position_x <= 1);
ALTER TABLE user_avatars ADD CONSTRAINT check_position_y CHECK (position_y >= 0 AND position_y <= 1);
ALTER TABLE user_avatars ADD CONSTRAINT check_zoom_level CHECK (zoom_level >= 0.1 AND zoom_level <= 3.0);

-- Create index for positioning queries
CREATE INDEX IF NOT EXISTS idx_user_avatars_positioning ON user_avatars(user_id, position_x, position_y, zoom_level);

-- Update existing records to have default positioning
UPDATE user_avatars
SET position_x = 0.5, position_y = 0.5, zoom_level = 1.0
WHERE position_x IS NULL OR position_y IS NULL OR zoom_level IS NULL;

-- Add comments
COMMENT ON COLUMN user_avatars.position_x IS 'Horizontal position offset (0.0-1.0) for circular avatar crop';
COMMENT ON COLUMN user_avatars.position_y IS 'Vertical position offset (0.0-1.0) for circular avatar crop';
COMMENT ON COLUMN user_avatars.zoom_level IS 'Zoom level (0.1-3.0) for avatar scaling within circle';