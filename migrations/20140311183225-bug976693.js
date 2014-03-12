module.exports = {
  up: function(migration, DataTypes) {
    migration.addColumn('Events', 'ageGroup', DataTypes.STRING);
    migration.addColumn('Events', 'skillLevel', DataTypes.STRING);
  },
  down: function(migration) {
    migration.removeColumn('Events', 'ageGroup', DataTypes.STRING);
    migration.removeColumn('Events', 'skillLevel', DataTypes.STRING);
  }
};
