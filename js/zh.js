/* 中文 for TT Firefighters: the words on the page, the toasts, the safety cards and the ? panel (Kit.lang, from
   kit/lang.js). Simple words: Tommy is 5. 消防员 (firefighter), 消防车 (fire truck), 灭火 (put out a fire),
   梯子 (ladder), 小猫 (kitten). The kids' names, Foxy and Froggy, and the game's own name stay in English on purpose. */
(function () {
  const L = Kit.lang;
  const title = window.FIRE_TITLE;
  const words = title.split(' ');
  L.keep(['TEDDY', 'TOMMY', 'FOXY', 'FROGGY', 'Teddy', 'Tommy', 'TT', title, words.slice(0, -1).join(' '), words[words.length - 1], 'Esc', 'Space', 'Enter']);

  const STREETS = {
    'MAPLE STREET': '枫树街', 'PIZZA CORNER': '披萨街角', 'TOY SHOP': '玩具店', 'SUNNY PARK': '阳光公园', 'TALL TOWER': '高高大楼', 'NIGHT TOWN': '夜晚小镇',
  };
  L.add(STREETS);
  L.add({
    // home
    'Pick a street': '选一条街', 'On your own or a race': '自己灭火还是比赛', 'JUST US': '我们灭火', 'RACE': '比赛',
    'Just us (R)': '我们灭火 (R)', 'Race Foxy and Froggy (R)': '和 Foxy、Froggy 比赛 (R)', 'Safety cards (C)': '安全卡片 (C)',
    "Who's driving?": '谁来开消防车？', 'BOTH': '一起开', 'Teddy drives': 'Teddy 开消防车', 'Tommy drives': 'Tommy 开消防车',
    'Teddy and Tommy drive': 'Teddy 和 Tommy 一起开', 'Easy': '简单', 'Normal': '普通', 'Go!': '出发！', 'Go! (Enter)': '出发！(回车)',
    '🃏 SAFETY CARDS': '🃏 安全卡片', 'Close': '关上',
    // firefighting
    'Pause': '暂停', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Sound on or off': '声音 开 / 关',
    'Call your brother': '叫兄弟来帮忙', 'High five': '击掌', 'LADDER': '梯子', 'WATER': '喷水',
    'Drive left': '往左开', 'Drive right': '往右开', 'Ladder up': '梯子升高', 'Ladder down': '梯子降低', 'Spray water': '喷水灭火',
    'GO!': '出发！', 'ALL SAFE!': '大家都安全啦！', 'FOXY GOT ONE!': 'FOXY 灭了一个火！', '🐱 FOXY SAVED A KITTEN!': '🐱 FOXY 救了一只小猫！',
    'TOO HOT! SPRAY THE FIRE FIRST!': '太烫啦！先把火灭掉！', 'NO WATER! DRIVE TO THE HYDRANT!': '没水啦！开到消防栓那里！',
    '💧 FILLING UP!': '💧 加水中！', '✋ HIGH FIVE!': '✋ 击掌！', '💧 TANKS FULL!': '💧 水箱满啦！',
    'HELP! MEOW!': '救命！喵！',
    // pause, results
    'Keep going': '继续', 'Start again': '重新开始', 'Streets': '选街道', 'Play again': '再玩一次', 'Next street': '下一条街',
    '🎉 ALL SAFE!': '🎉 大家都安全啦！', '🎉 GREAT TEAMWORK!': '🎉 配合得真棒！', '🦊🐸 FOXY AND FROGGY WIN!': '🦊🐸 FOXY 和 FROGGY 赢啦！',
    'NEW BEST!': '新纪录！', '🃏 NEW SAFETY CARD!': '🃏 新的安全卡片！', '🃏 SAFETY CARD': '🃏 安全卡片',
    // the safety cards (js/levels.js)
    'STOP, DROP AND ROLL!': '停、躺、滚！', 'If your clothes catch fire: stop, drop to the ground and roll.': '衣服着火了：停下来，躺在地上，打滚！',
    'HOT THINGS ARE FOR GROWN-UPS': '烫的东西让大人来', 'Matches, lighters and stoves are for grown-ups only.': '火柴、打火机和炉子，只有大人可以用。',
    'BEEP BEEP? GET OUT!': '嘀嘀响？快出去！', 'When the smoke alarm beeps, go outside fast and stay out.': '烟雾报警器响了，马上跑到外面，不要再进去。',
    'PICK A MEETING SPOT': '选一个集合点', 'Choose a place outside, like a big tree, where your family meets.': '和家人在外面选一个地方集合，比如一棵大树。',
    'GET LOW AND GO': '弯腰低头快快走', 'Smoke goes up, so crawl low under it to the door.': '烟往上飘，要在烟下面爬到门口。',
    'GET OUT, THEN CALL 911': '先出去，再打 911', 'Go outside first. Then a grown-up calls 911.': '先跑到外面，再请大人打 911。',
    // the ? panel (js/keys.js)
    'Teddy (left)': 'Teddy（左边）', 'Tommy (right)': 'Tommy（右边）',
    'drive the fire truck': '开消防车', 'ladder up / down': '梯子 升高 / 降低', 'spray water (hold)': '喷水灭火（按住）',
    'pick a street': '选街道', 'level 🐣 / 🔥': '难度 🐣 / 🔥', 'who drives': '谁来开', 'just us or a race': '我们灭火或比赛',
    'safety cards': '安全卡片', 'go! · again': '出发！· 再来', 'next street': '下一条街',
    'Drive under a fire, raise the ladder until the basket is in front of it and hold the water. Bring the basket close to a kitten and it hops in (put out the fire in its window first). In 1 player both sets of keys work and T calls your brother, who sprays the big fire; with 2 players, T is a high five that fills both water tanks.':
      '把消防车开到火下面，升高梯子，让篮子对准火，按住喷水灭火。把篮子靠近小猫，小猫就会跳进来（先把它窗口的火灭掉）。一个人玩时两套按键都能用，T 叫兄弟来帮你灭大火；两个人玩时，T 是击掌，两个水箱都会加满。',
    "The ◀ ▶ ▲ ▼ pad drives and moves the ladder, hold 💧 to spray. Tap your brother's face to call him.":
      '◀ ▶ ▲ ▼ 开车和移动梯子，按住 💧 喷水。点兄弟的头像叫他来。',
  });

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^PSSSH! \+(\d+)$/, '噗嗤！灭火啦！+$1');
  L.rule(/^BIG FIRE OUT! \+(\d+)$/, '大火灭掉啦！+$1');
  L.rule(/^🐱 KITTEN SAVED! \+(\d+)$/, '🐱 救到小猫啦！+$1');
  L.rule(/^(\S+) SAYS: I'LL GET THE BIG FIRE!$/, '$1 说：大火交给我！');
  L.rule(/^(\S+) SAYS: WATER RAINBOW!$/, '$1 说：喷个水彩虹！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${who} 给你${TREAT[item]}！`);
  L.rule(/^🏆 (\S+) WINS!$/, '🏆 $1 赢啦！');
  L.rule(/^(\S+) (MAPLE STREET|PIZZA CORNER|TOY SHOP|SUNNY PARK|TALL TOWER|NIGHT TOWN)$/, (m, e, s) => `${e} ${STREETS[s]}`);
  L.rule(/^Finish (MAPLE STREET|PIZZA CORNER|TOY SHOP|SUNNY PARK|TALL TOWER|NIGHT TOWN) to get this card\.$/, (m, s) => `完成「${STREETS[s]}」就能拿到这张卡片。`);
})();
