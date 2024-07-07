function areObjectsEqual(obj1, obj2) {
    // Check if both inputs are objects
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
        return false;
    }

    // Get the keys of both objects
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    // Check if both objects have the same number of keys
    if (keys1.length !== keys2.length) {
        return false;
    }

    // Check if both objects have the same keys and values
    for (let key of keys1) {
        // Check if the key exists in the second object
        if (!keys2.includes(key)) {
            return false;
        }

        // Check if the values for the key are objects themselves, and perform deep comparison
        if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
            if (!areObjectsEqual(obj1[key], obj2[key])) {
                return false;
            }
        } else {
            // Check if the values for the key are the same
            if (obj1[key] !== obj2[key]) {
                return false;
            }
        }
    }

    return true;
}

module.exports = areObjectsEqual
