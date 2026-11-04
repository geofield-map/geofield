// Formation library: Eastern Saudi Arabia (Arabian Platform), youngest to oldest.
// Choosing a formation fills Era / Period / Epoch / Age and limits the Member list.
// Source: Generalized Stratigraphy of Eastern Saudi Arabia (2016 chart), standard ICS time names.

export const FORMATIONS = [
  { name: 'Hofuf', era: 'Cenozoic', period: 'Neogene', epoch: 'Late Miocene–Pliocene', age: 'Tortonian–Pliocene', members: [] },
  { name: 'Dam', era: 'Cenozoic', period: 'Neogene', epoch: 'Middle Miocene', age: 'Langhian–Serravallian', members: [] },
  { name: 'Hadrukh', era: 'Cenozoic', period: 'Neogene', epoch: 'Early Miocene', age: 'Aquitanian–Burdigalian', members: ['Upper Hadrukh', 'Middle Hadrukh', 'Lower Hadrukh'] },
  { name: 'Dammam', era: 'Cenozoic', period: 'Paleogene', epoch: 'Eocene', age: 'Ypresian–Bartonian', members: ['Alat', 'Khobar', 'Alveolina', 'Saila', 'Midra'] },
  { name: 'Rus', era: 'Cenozoic', period: 'Paleogene', epoch: 'Early Eocene', age: 'Ypresian', members: [] },
  { name: 'Umm Er Radhuma', era: 'Cenozoic', period: 'Paleogene', epoch: 'Paleocene–Early Eocene', age: 'Danian–Ypresian', members: [] },
  { name: 'Aruma', era: 'Mesozoic', period: 'Cretaceous', epoch: 'Late Cretaceous', age: 'Santonian–Maastrichtian', members: ['Laffan Shale'] },
  { name: 'Wasia', era: 'Mesozoic', period: 'Cretaceous', epoch: 'Early–Late Cretaceous', age: 'Albian–Turonian',
    members: ['Ruwaydha', 'Tuwayil', 'Mishrif', 'Rumaila', 'Ahmadi', 'Wara', 'Mauddud', 'Safaniya', 'Khafji'] },
  { name: "Shu'aiba", era: 'Mesozoic', period: 'Cretaceous', epoch: 'Early Cretaceous', age: 'Aptian', members: [] },
  { name: 'Biyadh', era: 'Mesozoic', period: 'Cretaceous', epoch: 'Early Cretaceous', age: 'Barremian–Aptian', members: [] },
  { name: 'Buwaib', era: 'Mesozoic', period: 'Cretaceous', epoch: 'Early Cretaceous', age: 'Valanginian–Hauterivian', members: [] },
  { name: 'Yamama', era: 'Mesozoic', period: 'Cretaceous', epoch: 'Early Cretaceous', age: 'Berriasian–Valanginian', members: ['Ratawi Shale', 'Ratawi Limestone'] },
  { name: 'Sulaiy', era: 'Mesozoic', period: 'Jurassic–Cretaceous', epoch: 'Late Jurassic–Early Cretaceous', age: 'Tithonian–Berriasian', members: [] },
  { name: 'Hith', era: 'Mesozoic', period: 'Jurassic', epoch: 'Late Jurassic', age: 'Tithonian', members: [] },
  { name: 'Arab', era: 'Mesozoic', period: 'Jurassic', epoch: 'Late Jurassic', age: 'Kimmeridgian–Tithonian', members: ['Arab A', 'Arab B', 'Arab C', 'Arab D'] },
  { name: 'Jubaila', era: 'Mesozoic', period: 'Jurassic', epoch: 'Late Jurassic', age: 'Kimmeridgian', members: [] },
  { name: 'Hanifa', era: 'Mesozoic', period: 'Jurassic', epoch: 'Late Jurassic', age: 'Oxfordian', members: [] },
  { name: 'Tuwaiq Mountain', era: 'Mesozoic', period: 'Jurassic', epoch: 'Middle Jurassic', age: 'Callovian', members: [] },
  { name: 'Dhruma', era: 'Mesozoic', period: 'Jurassic', epoch: 'Middle Jurassic', age: 'Bajocian–Bathonian', members: ['Upper Dhruma', 'Lower Dhruma'] },
  { name: 'Marrat', era: 'Mesozoic', period: 'Jurassic', epoch: 'Early Jurassic', age: 'Toarcian', members: ['Upper Marrat', 'Middle Marrat', 'Lower Marrat'] },
  { name: 'Minjur', era: 'Mesozoic', period: 'Triassic', epoch: 'Late Triassic', age: 'Norian–Rhaetian', members: ['Upper Minjur', 'Lower Minjur'] },
  { name: 'Jilh', era: 'Mesozoic', period: 'Triassic', epoch: 'Middle–Late Triassic', age: 'Anisian–Carnian', members: ['Upper Jilh', 'Middle Jilh', 'Lower Jilh'] },
  { name: 'Sudair', era: 'Mesozoic', period: 'Triassic', epoch: 'Early Triassic', age: 'Induan–Olenekian', members: ['Upper Sudair', 'Lower Sudair'] },
  { name: 'Khuff', era: 'Paleozoic–Mesozoic', period: 'Permian–Triassic', epoch: 'Lopingian–Early Triassic', age: 'Wuchiapingian–Induan',
    members: ['Khuff A', 'Khuff B', 'Khuff C', 'Khuff D', 'Khuff E / Basal Khuff Clastics'] },
  { name: 'Nuayyim', era: 'Paleozoic', period: 'Permian', epoch: 'Cisuralian', age: 'Sakmarian–Kungurian', members: [] },
  { name: 'Unayzah', era: 'Paleozoic', period: 'Carboniferous–Permian', epoch: 'Pennsylvanian–Cisuralian', age: 'Kasimovian–Kungurian',
    members: ['Upper Unayzah', 'Lower Unayzah', 'Tinat', 'Wudayhi', 'Jawb', 'Ghazal'] },
  { name: 'Juwayl', era: 'Paleozoic', period: 'Carboniferous–Permian', epoch: 'Pennsylvanian–Cisuralian', age: 'Gzhelian–Asselian', members: [] },
  { name: 'Berwath', era: 'Paleozoic', period: 'Carboniferous', epoch: 'Mississippian', age: 'Visean–Serpukhovian', members: ['Upper Berwath', 'Lower Berwath'] },
  { name: 'Jubah', era: 'Paleozoic', period: 'Devonian', epoch: 'Late Devonian', age: 'Frasnian–Famennian', members: [] },
  { name: 'Jauf', era: 'Paleozoic', period: 'Devonian', epoch: 'Early Devonian', age: 'Pragian–Emsian', members: [] },
  { name: 'Tawil', era: 'Paleozoic', period: 'Silurian–Devonian', epoch: 'Pridoli–Early Devonian', age: 'Pridoli–Lochkovian', members: [] },
  { name: 'Qalibah', era: 'Paleozoic', period: 'Silurian', epoch: 'Llandovery–Wenlock', age: 'Rhuddanian–Sheinwoodian', members: ['Sharawra', 'Qusaiba'] },
  { name: 'Sarah', era: 'Paleozoic', period: 'Ordovician', epoch: 'Late Ordovician', age: 'Hirnantian', members: [] },
  { name: 'Qasim', era: 'Paleozoic', period: 'Ordovician', epoch: 'Middle–Late Ordovician', age: 'Darriwilian–Katian', members: ['Quwarah', "Ra'an", 'Kahfah', 'Hanadir'] },
  { name: 'Saq', era: 'Paleozoic', period: 'Cambrian–Ordovician', epoch: 'Late Cambrian–Early Ordovician', age: 'Furongian–Floian', members: ['Sajir', 'Risha'] },
  { name: 'Burj', era: 'Paleozoic', period: 'Cambrian', epoch: 'Middle Cambrian', age: 'Miaolingian', members: [] },
  { name: 'Siq', era: 'Paleozoic', period: 'Cambrian', epoch: 'Early–Middle Cambrian', age: 'Cambrian', members: [] },
  { name: 'Undefined (Ediacaran)', era: 'Neoproterozoic', period: 'Ediacaran', epoch: '', age: 'Ediacaran', members: [] },
  { name: 'Basement', era: 'Neoproterozoic', period: 'Tonian–Cryogenian', epoch: '', age: 'Precambrian', members: [] },
];

export const FORMATION_NAMES = FORMATIONS.map(f => f.name);
export const ALL_MEMBERS = FORMATIONS.flatMap(f => f.members);

export function findFormation(name) {
  if (!name) return null;
  const n = String(name).toLowerCase().replace(/\s*(formation|fm\.?)$/i, '').trim();
  return FORMATIONS.find(f => f.name.toLowerCase() === n) || null;
}

// Fields filled from the formation choice: schema key -> formation property
export const FORMATION_FILLS = { era: 'era', period: 'period', epoch: 'epoch', age: 'age' };

// Time-scale colours taken from the Generalized Stratigraphy of Eastern Saudi Arabia chart.
const CHRONO_COLOURS = {
  // eras
  Cenozoic: '#FFF4B5', Mesozoic: '#4DCEE1', Paleozoic: '#9ED6BB', Neoproterozoic: '#FFC16B', Precambrian: '#FFC16B',
  // periods
  Quaternary: '#FFF4A5', Neogene: '#FFEA67', Paleogene: '#FFBA8C', Cretaceous: '#86D08A', Jurassic: '#4FD0EA', Triassic: '#9767B4',
  Permian: '#FF7F69', Carboniferous: '#66C6C1', Devonian: '#E7B673', Silurian: '#B7E2D4', Ordovician: '#21BB9F', Cambrian: '#8FC894',
  Ediacaran: '#FFD885', Cryogenian: '#FFCE78', Tonian: '#FFCE78',
  // epochs
  Holocene: '#FFF4B4', Pleistocene: '#FFF4B4', Pliocene: '#FFF4B4', Miocene: '#FFEF86', Oligocene: '#FFE4C8', Eocene: '#FFCA9F', Paleocene: '#FFC394',
  'Late Cretaceous': '#B3DA86', 'Early Cretaceous': '#93D491', 'Late Jurassic': '#ADE8F4', 'Middle Jurassic': '#92E1F0', 'Early Jurassic': '#73D9EC',
  'Late Triassic': '#C7B4D9', 'Middle Triassic': '#BF99CC', 'Early Triassic': '#A973B9', Lopingian: '#FFCCC2', Guadalupian: '#FFA696', Cisuralian: '#FF9281',
  Pennsylvanian: '#99D5D5', Mississippian: '#85D2CF', 'Late Devonian': '#F7E6C1', 'Middle Devonian': '#FFD79C', 'Early Devonian': '#F5C886',
  Pridoli: '#DDF2EC', Ludlow: '#DDF2EC', Wenlock: '#D2EDE6', Llandovery: '#C7E8DE', 'Late Ordovician': '#8EDBCE', 'Middle Ordovician': '#6FD2C2',
  'Early Ordovician': '#4BC7B2', Furongian: '#B7E3C1', 'Late Cambrian': '#B7E3C1', Miaolingian: '#ADDDB7', 'Middle Cambrian': '#ADDDB7', 'Early Cambrian': '#95D0A6',
};

// Formation colours from the same chart. Members use their formation's colour.
const FORMATION_COLOURS = {
  Hofuf: '#FFEA96', Dam: '#FFE682', Hadrukh: '#FFE15F', Dammam: '#FFC09C', Rus: '#FFB593', 'Umm Er Radhuma': '#FFC68A',
  Aruma: '#F4EEAE', Wasia: '#CFE08E', "Shu'aiba": '#C9E3AF', Biyadh: '#B8DDA8', Buwaib: '#ABD9A1', Yamama: '#93D091',
  Sulaiy: '#91D08E', Hith: '#D2EDE3', Arab: '#C4E7F6', Jubaila: '#C6EDF5', Hanifa: '#B6EAF5', 'Tuwaiq Mountain': '#B2E9F4',
  Dhruma: '#A3E5F2', Marrat: '#7FDAF7', Minjur: '#B6ACD4', Jilh: '#A78EC6', Sudair: '#8F66B4', Khuff: '#FED3CA',
  Nuayyim: '#F6AA9E', Unayzah: '#F6968C', Juwayl: '#E79083', Berwath: '#86C390', Jubah: '#F0EFD5', Jauf: '#F9D590',
  Tawil: '#EAD896', Qalibah: '#80D1BE', Sarah: '#AED4BC', Qasim: '#4CC6AD', Saq: '#E0EED5', Burj: '#B0D1AC', Siq: '#95C798',
  'Undefined (Ediacaran)': '#FFD5A0', Basement: '#FF9779',
};

export function formationColour(name) {
  const fm = findFormation(name);
  return fm ? FORMATION_COLOURS[fm.name] || null : null;
}
const CHRONO_KEYS = Object.keys(CHRONO_COLOURS).sort((a, b) => b.length - a.length);

// Colour for a time name such as "Paleogene", "Early Cretaceous" or "Permian–Triassic" (older part wins).
export function chronoColour(name) {
  if (!name) return null;
  const first = String(name).split(/[–-]/)[0].trim();
  for (const text of [first, String(name)]) {
    if (CHRONO_COLOURS[text]) return CHRONO_COLOURS[text];
    const k = CHRONO_KEYS.find(key => text.toLowerCase().includes(key.toLowerCase()));
    if (k) return CHRONO_COLOURS[k];
  }
  return null;
}

// Lithology key of the chart, used in the log.
export const CHART_LITHOLOGIES = [
  'Limestone', 'Dolomitic limestone', 'Argillaceous limestone', 'Calcarenitic limestone', 'Calcarenite', 'Wackestone',
  'Dolomite', 'Argillaceous dolomite', 'Shale-Claystone', 'Silty clay, Mudstone', 'Siltstone', 'Siltstone (irregular)',
  'Sandstone', 'Sandstone (bedded)', 'Conglomerate', 'Diamictite', 'Anhydrite', 'Gypsum', 'Salts', 'Volcanics', 'Basement',
  'Dune sand', 'Rootlets / palaeosol',
];
