from PIL import Image
im = Image.open(r'D:/xiaohongshu/obsidian/covers-all.png')
names = ['home', 'vocab', 'ai', 'pomodoro', 'habit', 'ledger']
for i, n in enumerate(names):
    out = rf'D:/xiaohongshu/obsidian/assets/cover-{i+1}-{n}.png'
    im.crop((0, i*1440, 1080, (i+1)*1440)).save(out)
    print('saved', out)
