import pandas as pd
import os
import json
import sys

def analyze_excel_file(filepath):
    try:
        df = pd.read_excel(filepath, nrows=5)
        columns = df.columns.tolist()
        return {
            "filename": os.path.basename(filepath),
            "columns": columns,
            "sample_data": df.fillna("").head(2).to_dict(orient="records")
        }
    except Exception as e:
        return {"filename": os.path.basename(filepath), "error": str(e)}

raw_dir = r"e:\AG\cfo-web-app\data_raw"
results = []
for filename in os.listdir(raw_dir):
    if filename.endswith(".xlsx"):
        results.append(analyze_excel_file(os.path.join(raw_dir, filename)))

print(json.dumps(results, indent=2, ensure_ascii=False))
