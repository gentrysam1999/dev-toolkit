/**
 * Saves a value to chrome.storage.local.
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
export function saveToStorage(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

/**
 * Loads a value from chrome.storage.local.
 * @param {string} key
 * @param {*} defaultValue - returned if key is not set
 * @returns {Promise<*>}
 */
export function loadFromStorage(key, defaultValue = null) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(key in result ? result[key] : defaultValue);
    });
  });
}
