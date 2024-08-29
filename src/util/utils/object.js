function snakeToCamel(snakeCaseStr) {
    return snakeCaseStr.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }
  
function convertKeysToCamelCase(obj) {
    if (Array.isArray(obj)) {
        return obj.map(item => convertKeysToCamelCase(item));
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((accumulator, key) => {
        const camelCaseKey = snakeToCamel(key);
        accumulator[camelCaseKey] = convertKeysToCamelCase(obj[key]);
        return accumulator;
        }, {});
    }
    return obj;
}

module.exports = {
    convertKeysToCamelCase
}