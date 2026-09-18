/**
 * Evaluation meals (tech spec § 10.5, implementation plan O11): 40 Persian
 * descriptions seeded from the two reference plans' foods plus common
 * off-plan meals. `expectedItems` are lower-case English keywords (`a|b`
 * accepts either spelling); an item counts as recalled when one returned
 * `englishLabel` contains the keyword.
 * `reviewed: false` until the owner has checked the expected items — the
 * release thresholds (tech spec § 19 item 4) are read only from reviewed rows.
 */
export interface EvalMeal {
  text: string;
  expectedItems: string[];
  reviewed: boolean;
}

const m = (text: string, expectedItems: string[]): EvalMeal => ({
  text,
  expectedItems,
  reviewed: false,
});

export const EVAL_MEALS: EvalMeal[] = [
  // Breakfasts from the plans
  m('۲ عدد تخم‌مرغ آب‌پز با یک کف دست نان سنگک و خیار و گوجه', ['egg', 'sangak', 'cucumber']),
  m('یک لیوان شیر کم‌چرب، ۴۰ گرم جو دوسر و ۳ عدد گردو', ['milk', 'oat', 'walnut']),
  m('۳۰ گرم پنیر با نان سنگک، سبزی خوردن و یک استکان چای', ['cheese', 'sangak', 'herb', 'tea']),
  m('املت ۲ تخم‌مرغ با یک کف دست نان سنگک', ['egg|omelet', 'sangak']),
  m('صبحانه: نان و پنیر و گردو', ['bread', 'cheese', 'walnut']),
  m('یک کاسه جو دوسر با شیر و یک موز کوچک', ['oat', 'milk', 'banana']),
  m('دو تا تخم مرغ نیمرو با نون بربری', ['egg', 'barbari']),
  m('چای شیرین و دو تا خرما', ['tea', 'date']),

  // Snacks
  m('یک عدد سیب متوسط', ['apple']),
  m('۳ عدد خرما با چای', ['date', 'tea']),
  m('یک کاسه ماست کم‌چرب', ['yogurt']),
  m('یک عدد موز کوچک', ['banana']),
  m('یک عدد پرتقال', ['orange']),
  m('یک مشت گردو و ۳ عدد خرما', ['walnut', 'date']),
  m('یه مشت بادام خام', ['almond']),
  m('یک لیوان دوغ', ['doogh']),

  // Lunches from the plans
  m('۱۵۰ گرم مرغ گریل با ۱۰۰ گرم برنج و سالاد بزرگ با یک قاشق چای‌خوری روغن زیتون', [
    'chicken',
    'rice',
    'salad',
    'olive oil',
  ]),
  m('یک سیخ جوجه کباب با یک کف دست نان سنگک و سبزی', ['chicken', 'sangak', 'herb']),
  m('یک کاسه عدسی با یک کف دست نان سنگک', ['lentil', 'sangak']),
  m('۱۵۰ گرم ماهی با سیب‌زمینی آب‌پز و سالاد', ['fish', 'potato', 'salad']),
  m('ماهی تنوری با سیب زمینی', ['fish', 'potato']),
  m('جوجه کباب بدون نون با سبزی خوردن', ['chicken', 'herb']),
  m('مرغ گریل ۱۵۰ گرم و برنج ۱۰۰ گرم', ['chicken', 'rice']),
  m('عدسی و نان', ['lentil', 'bread']),

  // Dinners from the plans
  m('کباب تابه‌ای با سبزی خوردن', ['kebab|kabab|patty', 'herb']),
  m('همبرگر خانگی با سبزی خوردن', ['burger', 'herb']),
  m('املت دو تخم‌مرغ با سالاد', ['egg|omelet', 'salad']),
  m('یک کاسه عدسی', ['lentil']),

  // Common off-plan meals
  m('یک بشقاب چلو خورشت قیمه با سالاد شیرازی', ['rice', 'gheymeh', 'salad']),
  m('چلوکباب کوبیده با گوجه کبابی و دوغ', ['rice', 'kebab|kabab|koobideh', 'tomato', 'doogh']),
  m('ساندویچ همبرگر با سیب‌زمینی سرخ‌کرده و نوشابه', ['burger', 'fries', 'soda']),
  m('دو تکه پیتزا پپرونی', ['pizza']),
  m('یک بشقاب قورمه سبزی با برنج', ['ghormeh', 'rice']),
  m('زرشک پلو با مرغ', ['barberry|zereshk', 'chicken']),
  m('یک کاسه آش رشته', ['ash reshteh']),
  m('کتلت با نان لواش و گوجه', ['cutlet|kotlet', 'lavash', 'tomato']),
  m('یک تکه کیک شکلاتی و یک فنجان قهوه', ['cake', 'coffee']),
  m('نصف طالبی', ['cantaloupe']),
  m('سالاد سزار با مرغ گریل', ['salad', 'chicken']),
  m('یک لیوان آب پرتقال طبیعی', ['orange juice']),
];
