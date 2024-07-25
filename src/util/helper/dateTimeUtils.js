exports.generateDailyTimeRanges = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
  
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid input: The provided dates are not valid ISO strings.");
    }
  
    const timeRanges =[]
    let currentDate = new Date(start);
  
    while (currentDate <= end) {
      const startTime = new Date(currentDate);
      startTime.setHours(0, 0, 0, 0);
      const endTime = new Date(currentDate);
      endTime.setHours(23, 59, 59, 999);
  
      timeRanges.push({
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });
  
      // Move to the next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  
    return timeRanges;
  }

exports.formatDateFromISOString = (isoString) => {
    const date = new Date(isoString);
  
    if (isNaN(date.getTime())) {
      throw new Error("Invalid input: The provided ISO string is not a valid date.");
    }
  
    const options = {day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

exports.transformData = (data, targetColumn) => {
    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    }

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    
    let result = [];
    
    for (let day = 1; day <= currentDay; day++) {
        let dateString = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        let dataEntry = data.find(entry => entry.date === dateString);
        result.push({
            date: day.toString(),
            value: dataEntry ? dataEntry[targetColumn] : 0
        });
    }
    
    return result;
}
  