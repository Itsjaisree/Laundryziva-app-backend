// Evidence photo lists on a task (before_photos / after_photos hold a JSON list of photo urls). Pure functions.
const parsePhotoList = (value) => {
  if (!value) return [];
  try {
    const list = JSON.parse(value);
    return Array.isArray(list) ? list.filter((u) => typeof u === 'string' && u) : [];
  } catch (e) {
    return [];
  }
};

// Adds photo urls to the ones a task already has, in order and without repeats.
// Returns { merged } or { error } when the task would end up with more than `max` photos.
const mergePhotoUrls = (currentValue, newUrls, max) => {
  const merged = parsePhotoList(currentValue);
  for (const url of newUrls) {
    if (!merged.includes(url)) merged.push(url);
  }
  if (merged.length > max) {
    return { error: `A task can have at most ${max} arrival photos (it has ${parsePhotoList(currentValue).length} already)` };
  }
  return { merged };
};

module.exports = { parsePhotoList, mergePhotoUrls };
