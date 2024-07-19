const statusChecker = (res, targetStatus) => {
  if (res.status != targetStatus) {
    console.log(res.body);
  }
  return res.status == targetStatus;
};

module.exports = {
  statusChecker,
};
