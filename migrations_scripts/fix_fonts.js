import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directoryPath = path.join(__dirname, 'src');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

walkDir(directoryPath, function(filePath) {
    if (filePath.endsWith('.jsx')) {
        let fileContent = fs.readFileSync(filePath, 'utf8');
        let regex = /<span([^>]*?)className=(['"`])([^'"`]*?)material-symbols-outlined([^'"`]*?)\2([^>]*?)>/g;
        
        // This checks if we already added notranslate.
        if (fileContent.match(/notranslate/)) {
            // we will replace carefully
            fileContent = fileContent.replace(regex, (match, p1, p2, p3, p4, p5) => {
                if (!match.includes('translate="no"')) {
                    return `<span${p1}className=${p2}${p3}material-symbols-outlined notranslate${p4}${p2} translate="no"${p5}>`;
                }
                return match;
            });
        } else {
             fileContent = fileContent.replace(regex, (match, p1, p2, p3, p4, p5) => {
                 return `<span${p1}className=${p2}${p3}material-symbols-outlined notranslate${p4}${p2} translate="no"${p5}>`;
             });
        }

        fs.writeFileSync(filePath, fileContent, 'utf8');
    }
});

console.log('Fixed all material-symbols-outlined spans to include notranslate!');
