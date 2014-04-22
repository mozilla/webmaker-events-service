module.exports = function (objArray) {
  var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
  var str = '';

  for (var key in objArray[0]) {
    str += key + ',';
  }

  str = str.slice(0, -1);
  str += '\r\n';

  for (var i = 0; i < array.length; i++) {
    var line = '';

    for (var index in array[i]) {
      if (line !== '') line += ',';

      var noLineBreaks = array[i][index];

      if (typeof noLineBreaks === 'string') {
        noLineBreaks = noLineBreaks.replace(/\n/g, ' ');
        noLineBreaks = '"' + noLineBreaks + '"';
      }

      line += noLineBreaks;
    }

    str += line + '\r\n';
  }

  return str;
};
