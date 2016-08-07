const FormData = require('form-data');

module.exports = function objectToFormData(obj) {
  const form = new FormData;
  Object.keys(obj).forEach(key => {
    form.append(key, obj[key]);
  });

  return form;
}
