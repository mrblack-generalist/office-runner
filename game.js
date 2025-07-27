const config = {
  type: Phaser.AUTO,
  width: 1300,
  height: 720,
  backgroundColor: '#87ceeb',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 600 }, debug: false }
  },
  scene: { preload, create, update }
};

let player, boss, ground, cursors;
let floorTiles = [], obstacles = [], coffees = [], obstacleGroup;
let score = 0, lives = 3;
let scoreText, timerText, hitPopup, rewardPopup;
let heartIcons = [];
let gameSpeed = 20, obstacleSpeed = -100;
let elapsedTime = 0, gameOver = false, lastHitTime = 0;
const HIT_COOLDOWN = 2000;

let bgTile, currentBGKey;
let spaceKey, escKey;
let startScreen, endScreen;
let level = 1, levelText;
let scoreTimer;

const game = new Phaser.Game(config);

function preload() {
  this.load.image('player', 'assets/player.png');
  this.load.image('boss', 'assets/boss.png');
  this.load.image('cubicle', 'assets/cubicle.png');
  this.load.image('printer', 'assets/printer.png');
  this.load.image('coffee', 'assets/coffee.png');
  this.load.image('floor', 'assets/floor.png');
  this.load.image('heart', 'assets/heart.png');
  this.load.image('office1', 'assets/office1.png');
  this.load.image('office2', 'assets/office2.png');
}

function create() {
  // Pause physics until game starts
  this.physics.pause();

  // Input setup
  cursors = this.input.keyboard.createCursorKeys();
  spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

  // Background tile
  currentBGKey = 'office1';
  bgTile = this.add.tileSprite(0, 0, config.width, config.height, currentBGKey)
    .setOrigin(0, 0).setDepth(-10).setAlpha(0.7).setTileScale(0.62);

  // Floor
  ground = this.physics.add.staticGroup();
  for (let x = 0; x <= config.width; x += 130) {
    let t = ground.create(x, 670, 'floor').setOrigin(0, 0);
    t.refreshBody();
    floorTiles.push(t);
  }

  // Player
  player = this.physics.add.sprite(300, 500, 'player').setScale(0.5).setDepth(1);
  player.setBounce(0.1).setCollideWorldBounds(true);
  player.body.setSize(player.displayWidth * 1.5, player.displayHeight)
    .setOffset(player.displayWidth * 0.2, player.displayHeight);

  // Boss
  boss = this.physics.add.sprite(0, 550, 'boss').setScale(0.5).setDepth(1);
  boss.setBounce(0.1).setCollideWorldBounds(true);

  // Colliders
  this.physics.add.collider(player, ground);
  this.physics.add.collider(boss, ground);
  this.physics.add.overlap(player, boss, handleHit, null, this);

  // Obstacle group
  obstacleGroup = this.physics.add.group();
  spawnObstacle(this, 1100);

  // UI
  this.add.rectangle(0, 0, 350, 140, 0xffffff, 0.7).setOrigin(0).setDepth(10);
  scoreText = this.add.text(20,20,'Score: 0',{
    fontFamily:'Arial', fontSize:'32px', fontStyle:'italic', fontWeight:'bold',
    color:'#000', stroke:'#fff', strokeThickness:2
  }).setDepth(11);
  timerText = this.add.text(20,60,'Time: 00:00:000',{
    fontFamily:'Arial', fontSize:'32px', fontStyle:'italic', fontWeight:'bold',
    color:'#000', stroke:'#fff', strokeThickness:2
  }).setDepth(11);

  // Lives icons
  for (let i = 0; i < 3; i++) {
    let heart = this.add.image(config.width - 40 - i*40, 30, 'heart')
      .setScale(0.05).setScrollFactor(0).setDepth(11);
    heartIcons.push(heart);
  }

  // Popups
  hitPopup = this.add.text(config.width/2, config.height/2 - 50, '-1', { fontSize:'64px', fill:'#f00', fontStyle:'bold' })
    .setOrigin(0.5).setAlpha(0).setDepth(12);
  rewardPopup = this.add.text(config.width/2, config.height/2 - 100, '+100', { fontSize:'48px', fill:'#0a0', fontStyle:'bold' })
    .setOrigin(0.5).setAlpha(0).setDepth(12);

  // Level text
  levelText = this.add.text(config.width-140,70,'Level: 1',{ fontFamily:'Verdana', fontSize:'25px', fontWeight:'bold', color:'#000' })
    .setDepth(11).setScrollFactor(0);

  // Start screen
  const cx = config.width/2, cy = config.height/2;
  let overlay = this.add.rectangle(cx,cy,config.width,config.height,0x000,1).setDepth(19);
  let s1 = this.add.text(cx,cy-60,'Your boss is chasing you over quarterly sheet mishaps!',{ fontSize:'24px', fill:'#fff' })
    .setOrigin(0.5).setDepth(20);
  let s2 = this.add.text(cx,cy-20,'←→ move, ↑ jump, ↓ drop. Avoid printers/desks; coffee = +1 life & +100 pts.',{ fontSize:'18px', fill:'#fff' })
    .setOrigin(0.5).setDepth(20);
  let s3 = this.add.text(cx,cy+40,'Press SPACE to Start',{ fontSize:'20px', fill:'#0f0' })
    .setOrigin(0.5).setDepth(20);
  startScreen = this.add.container(0,0,[overlay,s1,s2,s3]).setVisible(true);

  // End screen
  let eOv = this.add.rectangle(cx,cy,config.width,config.height,0x000,1).setDepth(19);
  let eMsg = this.add.text(cx,cy-40,'',{ fontSize:'32px', fill:'#fff' })
    .setOrigin(0.5).setDepth(20);
  let e2 = this.add.text(cx,cy+20,'SPACE = Restart | ESC = Home',{ fontSize:'20px', fill:'#0f0' })
    .setOrigin(0.5).setDepth(20);
  endScreen = this.add.container(0,0,[eOv,eMsg,e2]).setVisible(false);
  endScreen.msgText = eMsg;

  // Score timer
  scoreTimer = this.time.addEvent({
    delay:1000,
    loop:true,
    paused:true,
    callback:()=>{
      if(!gameOver){ score+=10; scoreText.setText(`Score: ${score}`); }
    }
  });
}

function update() {
  // HOME
  if (startScreen.visible) {
    if (Phaser.Input.Keyboard.JustDown(spaceKey)) {
      startScreen.setVisible(false);
      resetGame.call(this);
    }
    return;
  }

  // GAME OVER
  if (gameOver) {
    if (Phaser.Input.Keyboard.JustDown(spaceKey)) {
      endScreen.setVisible(false);
      resetGame.call(this);
    } else if (Phaser.Input.Keyboard.JustDown(escKey)) {
      showHome.call(this);
    }
    return;
  }

  // GAME LOOP
  bgTile.tilePositionX += gameSpeed;
  floorTiles.forEach(t=>{ t.x -= gameSpeed; if(t.x+t.width<0) t.x = config.width; t.refreshBody(); });

  // Player movement
  player.setVelocityX(0);
  if (cursors.left.isDown) player.setVelocityX(-160);
  if (cursors.right.isDown) player.setVelocityX(160);
  if ((cursors.up.isDown || Phaser.Input.Keyboard.JustDown(spaceKey)) && player.body.touching.down) {
    player.setVelocityY(-470);
  }
  if (cursors.down.isDown && !player.body.touching.down) player.setVelocityY(600);

  // Spawn
  if (obstacles.length===0 || obstacles[obstacles.length-1].x < 800) {
    const r = Phaser.Math.Between(0,100);
    if(r<5) spawnObstacle(this,1300);
    else if(r<8) spawnCoffee(this,1300);
  }

  // Cleanup
  obstacles = obstacles.filter(o=>o && o.body && o.x+o.displayWidth>=0);
  coffees   = coffees.filter(c=>c && c.body && c.x+c.displayWidth>=0);

  // Timer
  elapsedTime += this.game.loop.delta;
  const tm=elapsedTime;
  const mm=Math.floor(tm/60000), ss=Math.floor((tm%60000)/1000), ms=Math.floor(tm%1000);
  timerText.setText(`Time: ${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}:${String(ms).padStart(3,'0')}`);

  // Difficulty
  const sec = Math.floor(elapsedTime/1000);
  if(sec%20===0 && sec!==0 && sec!==this.lastBoost){
    gameSpeed+=2;
    obstacleSpeed-=50;
    this.lastBoost=sec;
  }

  // Level & BG
  const lvl = Math.floor(sec/60)+1;
  if(lvl!==level){
    level=lvl;
    levelText.setText(`Level: ${lvl}`);
    const key = (lvl%2===0)?'office2':'office1';
    if(key!==currentBGKey){
      currentBGKey=key;
      this.tweens.add({ targets:bgTile, alpha:0, duration:300,
        onComplete:()=>{ bgTile.setTexture(key); this.tweens.add({ targets:bgTile, alpha:0.7, duration:300 }); }
      });
    }
  }
}

function resetGame() {
  scoreTimer.paused = false;
  score=0; scoreText.setText('Score: 0');
  elapsedTime=0; gameOver=false;
  gameSpeed=20; obstacleSpeed=-100;
  level=1; levelText.setText('Level: 1');
  currentBGKey='office1'; bgTile.setTexture('office1').setAlpha(0.7);
  lives=3; heartIcons.forEach(h=>h.setVisible(true));
  player.clearTint().setAlpha(1).setPosition(300,500);
  boss.clearTint().setAlpha(1).setPosition(0,550);
  obstacles.forEach(o=>o.destroy()); obstacles=[];
  coffees.forEach(c=>c.destroy()); coffees=[];
  spawnObstacle(this,1100);
  this.physics.resume();
}

function showHome() {
  score=0; scoreText.setText('Score: 0');
  elapsedTime=0; timerText.setText('Time: 00:00:000');
  scoreTimer.paused=true;
  startScreen.setVisible(true);
  endScreen.setVisible(false);
  gameOver=false;
  this.physics.pause();
}

function spawnObstacle(scene,x){
  const key=Math.random()<0.5?'cubicle':'printer';
  const o=scene.physics.add.sprite(x,670,key).setOrigin(0.5,1).setScale(0.15);
  o.body.allowGravity=false; o.setImmovable(true);
  obstacleGroup.add(o); obstacles.push(o);
  scene.physics.add.collider(o,ground);
  o.setVelocityX(obstacleSpeed);
  scene.physics.add.overlap(player,o,handleHit,null,scene);
}

function spawnCoffee(scene,x){
  const c=scene.physics.add.sprite(x,670,'coffee').setOrigin(0.5,1).setScale(0.2);
  c.body.allowGravity=false; c.setImmovable(true); c.setVelocityX(obstacleSpeed);
  coffees.push(c);
  scene.physics.add.collider(c,ground);
  scene.physics.add.overlap(player,c,handleCoffeePickup,null,scene);
}

function handleHit() {
  if (gameOver) return;
  const now = this.time.now;
  if (now - lastHitTime < HIT_COOLDOWN) return;
  lastHitTime = now;
  lives--; if (lives>=0) heartIcons[lives].setVisible(false);
  this.tweens.add({targets:player,alpha:0,yoyo:true,repeat:5,duration:200});
  hitPopup.setAlpha(1).setY(config.height/2-50);
  this.tweens.add({targets:hitPopup,alpha:0,y:'-=30',duration:800,ease:'Power1'});
  if (lives<=0) {
    gameOver=true; this.physics.pause();
    obstacles.forEach(o=>o.setVelocityX(0)); coffees.forEach(c=>c.setVelocityX(0));
    player.setTint(0xff0000); boss.setTint(0xff0000);
    endScreen.msgText.setText(`Game Over! Score: ${score}`);
    endScreen.setVisible(true);
  }
}

function handleCoffeePickup(player, coffee) {
  // scene is `this`
  coffee.destroy();
  score += 100;
  scoreText.setText(`Score: ${score}`);
  rewardPopup.setText('+100').setAlpha(1).setY(config.height/2 - 100);
  this.tweens.add({ targets: rewardPopup, alpha: 0, y: '-=40', duration: 800 });
  if (lives < 3) {
    heartIcons[lives].setVisible(true);
    lives++;
    const hb = this.add.text(config.width/2, config.height/2 - 120, '+1 ❤️', { fontSize: '40px', fill: '#f36', fontStyle:'bold' })
      .setOrigin(0.5);
    this.tweens.add({ targets: hb, alpha: 0, y: '-=30', duration: 1000, onComplete: ()=>hb.destroy() });
  }
}
