// src/constants/brands.ts
export interface BrandConfig {
  name: string;
  logo: string;
  showName?: boolean;
}

export const FOOD_BRANDS: BrandConfig[] = [
    { name: "McDonald's", logo: './brands/mcdonalds.png', showName: true },
    { name: "Starbucks", logo: './brands/starbucks.png', showName: true },
    { name: "Taco Bell", logo: './brands/tacobell.png', showName: true },
    { name: "Wendy's", logo: './brands/wendys.png', showName: true },
    { name: "Chipotle", logo: './brands/chipotle.png' },
    { name: "Chick-fil-A", logo: './brands/chickfila.png', showName: true },
    { name: "Subway", logo: './brands/subway.png' },
    { name: "Popeyes", logo: './brands/popeyes.png' },
    { name: "Dominos", logo: './brands/dominos.png', showName: true },
    { name: "Dunkin'", logo: './brands/dunkin.png', showName: true },
    { name: "Arby's", logo: './brands/arbys.png' },
    { name: "Panera", logo: './brands/panera.png' },
    { name: "KFC", logo: './brands/kfc.png' },
    { name: "Burger King", logo: './brands/burgerking.png' },
    { name: "Five Guys", logo: './brands/fiveguys.png' },
    { name: "In-N-Out", logo: './brands/innout.png' },
    { name: "Jack in the Box", logo: './brands/jackinthebox.png' },
    { name: "Sonic", logo: './brands/sonic.png' },
    { name: "Dairy Queen", logo: './brands/dairyqueen.png', showName: true },
    { name: "Little Caesars", logo: './brands/littlecaesars.png', showName: true },
    { name: "Papa John's", logo: './brands/papajohns.png' },
    { name: "Pizza Hut", logo: './brands/pizzahut.png' },
    { name: "Waffle House", logo: './brands/wafflehouse.png' },
    { name: "Culver's", logo: './brands/culvers.png' },
    { name: "Shake Shack", logo: './brands/shakeshack.png', showName: true },
    { name: "Jamba Juice", logo: './brands/jamba.png' },
    { name: "Tim Hortons", logo: './brands/timhortons.png' },
    { name: "Jimmy John's", logo: './brands/jimmyjohns.png' },
    { name: "Bob Evans", logo: './brands/bobevans.png' },
    { name: "Jersey Mike's", logo: './brands/jerseymikes.png' },
    { name: "Panda Express", logo: './brands/pandaexpress.png' },
    { name: "White Castle", logo: './brands/whitecastle.png' },
    { name: "Skyline Chili", logo: './brands/skylinechili.png' },
    { name: "Raising Cane's", logo: './brands/raisingcanes.png' },
    { name: "Chili's", logo: './brands/chilis.png', showName: true },
    { name: "Applebee's", logo: './brands/applebees.png' },
    { name: "Smoothie King", logo: './brands/smoothieking.png' },
    { name: "Buffalo Wild Wings", logo: './brands/bww.png', showName: true },
    { name: "Olive Garden", logo: './brands/olivegarden.png' },
    { name: "Red Lobster", logo: './brands/redlobster.png' },
    { name: "Outback Steakhouse", logo: './brands/outback.png' },
    { name: "Texas Roadhouse", logo: './brands/texasroadhouse.png' },
    { name: "Cracker Barrel", logo: './brands/crackerbarrel.png' },
    { name: "The Cheesecake Factory", logo: './brands/thecheesecakefactory.png' },
    { name: "LongHorn Steakhouse", logo: './brands/longhorn.png' },
    { name: "Olipop", logo: './brands/olipop.png' },
    { name: "Lay's", logo: './brands/lays.png' },
    { name: "Coca-Cola", logo: './brands/cocacola.png' },
    { name: "Pepsi", logo: './brands/pepsi.png' },
    { name: "Tropical Smoothie Cafe", logo: './brands/tropicalsmoothie.png' },
    { name: "Prego", logo: './brands/prego.png' },
    { name: "Meijer", logo: './brands/meijer.png' },
    { name: "Oikos", logo: './brands/dannon.png', showName: true},
    { name: "Dannon", logo: './brands/dannon.png' },
    { name: "Cheerios", logo: './brands/cheerios.png' },
    { name: "Smuckers", logo: './brands/smuckers.png' },
    { name: "Raybern's", logo: './brands/rayberns.png' },
    { name: "La Banderita", logo: './brands/labanderita.png' },
    { name: "Dave's Hot Chicken", logo: './brands/daveshotchicken.png' },
    { name: "Pop Tarts", logo: './brands/poptarts.png' },
    { name: "Hotpockets", logo: './brands/hotpockets.png' },
    { name: "Halo Top", logo: './brands/halotop.png' },
    { name: "Sargento", logo: './brands/sargento.png' },
    { name: "Bertolli", logo: './brands/bertolli.png' },
    { name: "Fresh by Meijer", logo: './brands/freshbymeijer.png' },
    { name: "Lifeway", logo: './brands/lifeway.png' },
    { name: "Cole's", logo: './brands/coles.png' },
    { name: "Saffron Road", logo: './brands/saffronroad.png' },
    { name: "Too Good", logo: './brands/toogood.png' },
    { name: "Clean Simple Eats", logo: './brands/cleansimpleeats.png' },
    { name: "Tyson", logo: './brands/tyson.png' },
    { name: "Stouffer's", logo: './brands/stouffers.png' },
    { name: "MUSH", logo: './brands/mush.png' },
    { name: "Chung's", logo: './brands/chungs.png' },
    { name: "Frankies", logo: './brands/frankies.png' },
    { name: "Hormel", logo: './brands/hormel.png' },
    { name: "Idahoan", logo: './brands/idahoan.png' },
    { name: "Bolthouse Farms", logo: './brands/bolthousefarms.png' },
    { name: "Dot's Homestyle Pretzels", logo: './brands/dotspretzels.png' },
    { name: "Hillshire Farm", logo: './brands/hillshirefarm.png' },
    { name: "That's it", logo: './brands/thatsit.png' },
    { name: "Big Shoulders Smokehouse", logo: './brands/bigshoulderssmokehouse.png' },
    { name: "Goodles", logo: './brands/goodles.png' },
    { name: "Pure Protein", logo: './brands/pureprotein.png' },
    { name: "Hamburger Helper", logo: './brands/hamburgerhelper.png' },
    { name: "Bibigo", logo: './brands/bibigo.png' },
    { name: "Stonefire", logo: './brands/stonefire.png' },
    { name: "Fiber One", logo: './brands/fiberone.png' },
    { name: "Mayfield", logo: './brands/mayfield.png' },
    { name: "Kitkat", logo: './brands/kitkat.png' },
    { name: "Screamin' Sicilian", logo: './brands/screaminsicilian.png' },
    { name: "Drumstick", logo: './brands/drumstick.png' },
    { name: "Koia", logo: './brands/koia.png' },
    { name: "Jimmy Dean", logo: './brands/jimmydean.png' },
    { name: "Kraft", logo: './brands/kraft.png' },
    { name: "Good & Gather", logo: './brands/goodandgather.png' },
    { name: "Rising Tide", logo: './brands/risingtide.png' },
    { name: "Kind", logo: './brands/kind.png' },
    { name: "Kellogg's", logo: './brands/kelloggs.png' },
    { name: "Michael Angelo's", logo: './brands/michaelangelos.png' },
    { name: "Naked", logo: './brands/nakedjuice.png' },
    { name: "Barebells", logo: './brands/barebells.png' },
    { name: "Philadelphia", logo: './brands/philadelphia.png' },
    { name: "Thomas'", logo: './brands/thomas.png' },
    { name: "Chobani", logo: './brands/chobani.png' },
    { name: "Knorr", logo: './brands/knorr.png' },
    { name: "Special K", logo: './brands/specialk.png' },
    { name: "Land O Lakes", logo: './brands/landolakes.png' },
    { name: "Mission", logo: './brands/mission.png' },
    { name: "Doritos", logo: './brands/doritos.png' },
    { name: "Farm Rich", logo: './brands/farmrich.png' },
    { name: "TGI FRIDAYS", logo: './brands/tgifridays.png' },
    { name: "Jack's", logo: './brands/jacks.png' },
    { name: "Fresh", logo: './brands/fresh.png' },
    { name: "Laoban", logo: './brands/laoban.png', showName: true },
    { name: "Genius Gourmet", logo: './brands/geniusgourmet.png' },
    { name: "Legendary", logo: './brands/legendary.png' },
    { name: "Tai Pei", logo: './brands/taipei.png' },
    { name: "Sara Lee", logo: './brands/saralee.png' },
    { name: "Daisy", logo: './brands/daisy.png' },
    { name: "True Goodness", logo: './brands/truegoodness.png' },
    { name: "Premier Protein", logo: './brands/premierprotein.png' },
    { name: "Nabisco", logo: './brands/nabisco.png' },
    { name: "Hellmann's", logo: './brands/hellmanns.png' },
    { name: "Nature Valley", logo: './brands/naturevalley.png' },
    { name: "StarKist", logo: './brands/starkist.png', showName: true},
    { name: "Angie's", logo: './brands/angies.png' },
    { name: "InnovAsian", logo: './brands/innovasian.png' },
    { name: "BIBIBOP", logo: './brands/bibibop.png' },
    { name: "Lance", logo: './brands/lance.png' },
    { name: "Johnsonville", logo: './brands/johnsonville.png' },
    { name: "OIKOS Pro", logo: './brands/dannon.png' },
    { name: "Betty Crocker", logo: './brands/bettycrocker.png' },
    { name: "KashiGo", logo: './brands/kashi.png' },
    { name: "Kashi", logo: './brands/kashi.png' },
    { name: "Bear Naked", logo: './brands/bearnaked.png' },
    { name: "Jell-o", logo: './brands/jello.png' },
    { name: "Marco's", logo: './brands/marcos.png' },
    { name: "RXBAR", logo: './brands/rxbar.png' },
    { name: "First Watch", logo: './brands/firstwatch.png' },
    { name: "Gorton's", logo: './brands/gortons.png' },
    { name: "Lunchables", logo: './brands/lunchables.png' },
    { name: "Pringles", logo: './brands/pringles.png' },
    { name: "Chomps", logo: './brands/chomps.png' },
    { name: "Fairlife", logo: './brands/fairlife.png' },
    { name: "Perdue", logo: './brands/perdue.png' },
    { name: "Bosco Sticks", logo: './brands/boscosticks.png' },
    { name: "Favorite Day", logo: './brands/favoriteday.png' },
    { name: "Cava", logo: './brands/cava.png' },
    { name: "El Monterey", logo: './brands/elmonterey.png' },
    { name: "Yoplait", logo: './brands/yoplait.png' },
    { name: "Heinz", logo: './brands/heinz.png' },
    { name: "Organic Rancher", logo: './brands/organicrancher.png' },
    { name: "New York Bakery", logo: './brands/newyorkbakery.png' },
    { name: "Domino", logo: './brands/domino.png' },
    { name: "Bagel Bites", logo: './brands/bagelbites.png' },
    { name: "Ore-Ida", logo: './brands/oreida.png' },
    { name: "Chobani Flip", logo: './brands/chobaniflip.png' },
    { name: "Hola Churros", logo: './brands/holachurros.png' },
    { name: "Bellatoria", logo: './brands/bellatoria.png' },
    { name: "Noka", logo: './brands/noka.png' },
    { name: "Minute", logo: './brands/minute.png' },
    { name: "WOW BAO", logo: './brands/wowbao.png' },
    { name: "Stacy's", logo: './brands/stacys.png' },
    { name: "Rao's", logo: './brands/raos.png' },
    { name: "Wholly Guacamole", logo: './brands/whollyguacamole.png' },
    { name: "Garden Fresh", logo: './brands/gardenfresh.png' },
    { name: "Butcherbox", logo: './brands/butcherbox.png' },
    { name: "Nature's Own", logo: './brands/naturesown.png' },
    { name: "JIF", logo: './brands/jif.png' },
    { name: "Barilla", logo: './brands/barilla.png' },
    { name: "Mila", logo: './brands/mila.png' },
    { name: "Eggo", logo: './brands/eggo.png' },
    { name: "Whole Foods", logo: './brands/wholefoods.png' },
    { name: "Oscar Mayer", logo: './brands/oscarmayer.png' },

    //{ name: "", logo: '' },
    
  // Add as many as you want here!
];

/**
 * Normalizes a string by converting to lowercase and stripping ALL 
 * spaces, punctuation, and special characters.
 * Example: "McDonald's" -> "mcdonalds"
 */
export const normalizeBrandName = (name: string) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

export const getBrandConfig = (inputName: string | undefined | null) => {
  if (!inputName) return null;
  const normalizedInput = normalizeBrandName(inputName);
  return FOOD_BRANDS.find(brand => normalizeBrandName(brand.name) === normalizedInput) || null;
};

/**
 * Takes an input brand string, normalizes it, and checks if it matches
 * any normalized brand names in our database. Returns the logo path if found.
 */
export const getBrandLogo = (inputName: string | undefined | null) => {
  if (!inputName) return null;
  
  const normalizedInput = normalizeBrandName(inputName);
  
  const matchedBrand = FOOD_BRANDS.find(brand => 
    normalizeBrandName(brand.name) === normalizedInput
  );

  return matchedBrand ? matchedBrand.logo : null;
};