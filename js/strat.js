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

// International chronostratigraphic colours (ICS / CGMW), as used on stratigraphic charts.
const CHRONO_COLOURS = {
  // eras
  Cenozoic: '#F2F91D', Mesozoic: '#67C5CA', Paleozoic: '#99C08D', Neoproterozoic: '#FEB342', Proterozoic: '#F73563', Precambrian: '#F74370',
  // periods
  Quaternary: '#F9F97F', Neogene: '#FFE619', Paleogene: '#FD9A52', Cretaceous: '#7FC64E', Jurassic: '#34B2C9', Triassic: '#812B92',
  Permian: '#F04028', Carboniferous: '#67A599', Devonian: '#CB8C37', Silurian: '#B3E1B6', Ordovician: '#009270', Cambrian: '#7FA056',
  Ediacaran: '#FED96A', Cryogenian: '#FECC5C', Tonian: '#FEBF4E',
  // epochs
  Holocene: '#FEF2E0', Pleistocene: '#FFF2AE', Pliocene: '#FFFF99', Miocene: '#FFFF00', Oligocene: '#FEC07A', Eocene: '#FDB46C', Paleocene: '#FDA75F',
  'Late Cretaceous': '#A6D84A', 'Early Cretaceous': '#8CCD57', 'Late Jurassic': '#B3E3EE', 'Middle Jurassic': '#80CFD8', 'Early Jurassic': '#42AED0',
  'Late Triassic': '#BD8CC3', 'Middle Triassic': '#B168B1', 'Early Triassic': '#983999', Lopingian: '#FBA794', Guadalupian: '#FB745C', Cisuralian: '#EF5845',
  Pennsylvanian: '#99C2B5', Mississippian: '#678F66', 'Late Devonian': '#F1E19D', 'Middle Devonian': '#F1C868', 'Early Devonian': '#E5AC4D',
  Pridoli: '#E6F5E1', Ludlow: '#BFE6CF', Wenlock: '#B3E1C2', Llandovery: '#99D7B3', 'Late Ordovician': '#7FCA93', 'Middle Ordovician': '#4DB47E',
  'Early Ordovician': '#1A9D6F', Furongian: '#B3E095', 'Late Cambrian': '#B3E095', 'Middle Cambrian': '#A6CF86', 'Early Cambrian': '#8CB06C',
};
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
