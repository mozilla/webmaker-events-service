CREATE TABLE `EventsTags` (
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `TagId` int(11) NOT NULL DEFAULT '0',
  `EventId` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`TagId`,`EventId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `Tags` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
