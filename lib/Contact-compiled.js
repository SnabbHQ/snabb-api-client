'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _ = require('lodash');
var phone = require('google-libphonenumber');
var PNF = phone.PhoneNumberFormat;
var phoneUtil = phone.PhoneNumberUtil.getInstance();

/**
  A contact.

  @param contact.first_name string The first name of the contact.
  @param contact.last_name string The last name of the contact.
  @param contact.email string The email of the contact.

  @param contact.phone object The phone details of the contact.
  @param contact.phone.number string The phone number of the contact.
  @param contact.phone.sms_enabled boolean If the phone has SMS capabilities.
*/

var Contact = function Contact(options) {
  var _this = this;

  _classCallCheck(this, Contact);

  _.each(options, function (value, key) {
    if (key == 'phone' && value) {
      var parsedNumber = undefined;

      if (value.number) {
        try {
          parsedNumber = phoneUtil.parse(value.number);
        } catch (e) {
          // Try adding +1 if number is 10+ chars but lacks country code,
          // as SnabbRush is only available in the US as of now.
          if (value.number.indexOf('+1') === -1 && value.number.replace(/ /g, '').length >= 10) {
            try {
              parsedNumber = phoneUtil.parse('+1' + value.number);
            } catch (e) {
              console.error('Unable to parse phone number [' + value.number + ']', e);
            }
          } else {
            // TODO also be strict if we're in the sandbox env
            if (options.strict) throw e;
          }
        }
      }

      value = {
        number: parsedNumber ? phoneUtil.format(parsedNumber, PNF.E164) : value.number,
        sms_enabled: value.sms_enabled || false
      };
    }

    _this[key] = value;
  });
};

module.exports = Contact;

//# sourceMappingURL=Contact-compiled.js.map