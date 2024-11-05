const hash = require('object-hash');

function snakeToCamel(snakeCaseStr) {
    return snakeCaseStr.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }
  
function convertKeysToCamelCase(obj) {

    try{
        if (Array.isArray(obj)) {
            return obj.map(item => convertKeysToCamelCase(item));
        } else if (obj !== null && typeof obj === 'object') {
            return Object.keys(obj).reduce((accumulator, key) => {
            const camelCaseKey = snakeToCamel(key);
            accumulator[camelCaseKey] = convertKeysToCamelCase(obj[key]);
            return accumulator;
            }, {});
        }
    }catch(error){
        return obj;
    }

    return obj;
}

/**
 * This function hashes an object by concatenating the keys and values, separated by "|SEP|", and then hashing the resulting string.
 * @param {*} obj 
 * @returns 
 */
function hashObject(obj){
    return hash(obj)
}

module.exports = {
    convertKeysToCamelCase,
    hashObject
}