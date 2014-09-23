# Delete duplicate tags on each event
DELETE `EventsTags` FROM `EventsTags` JOIN `Tags` ON `TagId` = `id`
  JOIN (SELECT MIN(`id`) AS `id`, `name`  FROM `Tags` GROUP BY `name`) AS `real_ids`
  ON `Tags`.`name` = `real_ids`.`name`
  WHERE `TagId` != `real_ids`.`id`;

# Link to the earliest created tag, for each named tag
UPDATE `EventsTags` AS `et` JOIN `Tags` AS `t` ON `TagId` = `id`
  SET `et`.`TagId` = (SELECT MIN(`id`) FROM `Tags` WHERE `name` = `t`.`name`);

# Delete now-orphaned tags
DELETE FROM `Tags` WHERE `id` NOT IN (SELECT `TagId` FROM `EventsTags`);
