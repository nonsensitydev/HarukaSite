import { readdir, writeFile } from 'node:fs/promises';
for (const [folder, extension] of [['vrms', 'vrm'], ['vrmas', 'vrma']]) {
  const directory = new URL(`../public/${folder}/`, import.meta.url);
  const files = (await readdir(directory, {withFileTypes:true}))
    .filter(file => file.isFile() && file.name.toLowerCase().endsWith(`.${extension}`))
    .map(file => file.name).sort();
  await writeFile(new URL('models.json', directory), JSON.stringify(files, null, 2)+'\n');
  console.log(`Registered ${files.length} ${extension.toUpperCase()} file(s).`);
}
