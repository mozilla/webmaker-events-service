# Enforce the uniqueness of tag names, finally!
CREATE UNIQUE INDEX `Tags_name_index` ON `Tags` (`name`);
