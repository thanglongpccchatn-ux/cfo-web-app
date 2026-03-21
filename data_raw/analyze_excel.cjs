const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const rawDir = __dirname;
const results = [];

fs.readdirSync(rawDir).forEach(file => {
  if (file.endsWith('.xlsx')) {
    try {
      const filePath = path.join(rawDir, file);
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Read first few rows
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: '' });
      
      // Assume row 0 is header
      const headers = data[0] || [];
      const sample_data = [];
      
      // Grab 2 sample rows
      for (let i = 1; i < Math.min(3, data.length); i++) {
          const rowObj = {};
          headers.forEach((h, index) => {
             rowObj[h || `Col${index}`] = data[i][index] || '';
          });
          sample_data.push(rowObj);
      }
      
      results.push({
          filename: file,
          columns: headers,
          sample_data: sample_data
      });
    } catch (e) {
      results.push({ filename: file, error: e.message });
    }
  }
});

console.log(JSON.stringify(results, null, 2));
