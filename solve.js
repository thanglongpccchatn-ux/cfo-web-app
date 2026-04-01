const XLSX = require('xlsx');

// 1. Read Excel file
const workbook = XLSX.readFile('E:\\AG\\ktoan\\Tìm tổng số bằng số cho trước.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// 2. Extract values
let values = [];
// Skip header row conventionally or try to find columns with numbers matching sum criteria.
// We'll just look for any number that is > 0 and <= target sum in all rows.

for (let i = 0; i < data.length; i++) {
    const row = data[i];
    for (let j = 0; j < row.length; j++) {
        const val = Number(row[j]);
        if (!isNaN(val) && val > 0 && Number.isInteger(val)) {
            values.push({
                row: i + 1,
                col: j + 1,
                value: val,
                originalText: String(row[j])
            });
        }
    }
}

// Remove duplicates? Sometimes columns have duplicates. Let's just find exactly 
// The target sum is 38336274
const TARGET_SUM = 38336274;
console.log(`Found ${values.length} numbers. Searching for subset sum of ${TARGET_SUM}...`);

// Backtracking subset sum
let found = false;

// Optimization: sort descending
values.sort((a, b) => b.value - a.value);

function backtrack(startIndex, currentSum, currentSubset) {
    if (currentSum === TARGET_SUM) {
        console.log("================ FOUND MATCH ================");
        console.log(`Sum: ${currentSum}`);
        console.log(`Items: ${currentSubset.length}`);
        
        currentSubset.forEach(item => {
            console.log(`- Row ${item.row}, Col ${item.col} => ${item.value.toLocaleString('vi-VN')} đ`);
        });
        found = true;
        return;
    }
    
    if (found || currentSum > TARGET_SUM || startIndex >= values.length) {
        return;
    }
    
    for (let i = startIndex; i < values.length; i++) {
        // Skip duplicate paths (not perfectly, but good enough)
        // Try including values[i]
        currentSubset.push(values[i]);
        backtrack(i + 1, currentSum + values[i].value, currentSubset);
        currentSubset.pop();
        if (found) return;
    }
}

let sumOfAll = values.reduce((acc, curr) => acc + curr.value, 0);
console.log(`Total sum of all numbers: ${sumOfAll.toLocaleString('vi-VN')}`);
if (sumOfAll < TARGET_SUM) {
    console.log("Error: Target sum is greater than the sum of all numbers.");
    process.exit(1);
}

backtrack(0, 0, []);

if (!found) {
    console.log("NO MATCH FOUND!");
}
