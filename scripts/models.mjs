import { readdir, writeFile } from 'node:fs/promises';
const directory = new URL('../public/vrms/', import.meta.url);
const models = (await readdir(directory, {withFileTypes:true})).filter(file => file.isFile() && /\.vrm$/i.test(file.name)).map(file => file.name).sort();
await writeFile(new URL('models.json', directory), JSON.stringify(models, null, 2)+'\n');
console.log(`Registered ${models.length} VRM model(s).`);
