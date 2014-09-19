# This index speeds up joining Tags to Events through the EventsTags join table
# On my local machine it was a 10x speed difference in the results query
CREATE INDEX `EventsTags_EventId_index` ON `EventsTags` (`EventId`);

# This index speeds up searching for Coorganizers and Mentors in the count and data queries
CREATE INDEX `Coorganizers_EventId_index` ON `Coorganizers` (`EventId`);
CREATE INDEX `Mentors_EventId_index` ON `Mentors` (`EventId`);
