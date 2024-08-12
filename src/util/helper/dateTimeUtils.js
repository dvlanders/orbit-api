const generateDailyTimeRanges = (startDate, endDate) => {
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

const formatDateFromISOString = (isoString) => {
    const date = new Date(isoString);
  
    if (isNaN(date.getTime())) {
      throw new Error("Invalid input: The provided ISO string is not a valid date.");
    }
  
    const options = {day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

const generateDatesFromStartToCurrent = (startDate) => {
    const start = new Date(startDate);
    const end = new Date(); // Current date
    const dates = [];

    let current = new Date(start);

    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]); // Push date in ISO format
        current.setDate(current.getDate() + 1); // Move to the next day
    }

    return dates;
}


const transformData = async(data, targetColumn, startDate) => {
    const dateList = generateDatesFromStartToCurrent(startDate.split('T')[0])
    
    const result = await Promise.all(dateList.map(async(date) => {
      let dataEntry = data.find(entry => entry.date === date);
      return {
            date: date,
            value: dataEntry ? dataEntry[targetColumn] : 0
      }
    }))
    
    return result;
}

const getNextCycleEnd = (lastCycleEnd) => {
  // Parse the input ISO date string
  let date = new Date(lastCycleEnd);
  
  // Add one month to the date
  let nextMonth = new Date(date);
  nextMonth.setMonth(date.getMonth() + 1);

  // Handle the edge case where the month changes the number of days (e.g., January 31 to February 28/29)
  if (nextMonth.getDate() < date.getDate()) {
      nextMonth.setDate(0);
  }
  
  // Convert the date back to ISO string
  return nextMonth.toISOString();
}


module.exports = {
  getNextCycleEnd,
  transformData,
  formatDateFromISOString,
  generateDatesFromStartToCurrent,
  generateDailyTimeRanges
}
  