/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Copy, RefreshCw, Sparkles, Heart, Briefcase, Coffee, CheckCircle2, MessageCircle, Github, Plus, LogIn, LogOut, User } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { collection, onSnapshot, addDoc, query, orderBy, limit, serverTimestamp, Timestamp } from "firebase/firestore";

// --- Helpers ---
const getGuestId = () => {
  let id = localStorage.getItem('guest_id');
  if (!id) {
    id = 'guest_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('guest_id', id);
  }
  return id;
};

// --- Types ---
type Category = "workplace" | "romance" | "slacking";

interface Quote {
  id: string | number;
  content: string;
}

interface Shout {
  id: string;
  content: string;
  color: string;
  y: number;
  speed: number;
}

// --- Constants & Data ---
// --- Constants & Data ---
const INITIAL_QUOTES: Record<Category, Quote[]> = {
  workplace: [
    { id: 101, content: "如果你觉得累，就对了，舒服是留给死人的。" },
    { id: 102, content: "老板，我不要工资，我就要一个公道。什么？工资五千？那公道不要了。" },
    { id: 103, content: "我上班就是为了赚钱，你非要跟我谈理想，我的理想就是不上班。" },
    { id: 104, content: "只要我不努力，老板就永远过不上他想要的生活。" },
    { id: 105, content: "早起的人有早饭吃，早起的人没有早起的人有早饭吃。" },
    { id: 106, content: "你说我态度有问题，我也觉得，如果你没问题的话，我怎么会有问题？" },
    { id: 107, content: "工作哪有不疯的，强撑罢了！" },
    { id: 108, content: "我是来工作的，不是来玩宫斗的，可是你们非要给我加戏。" },
    { id: 109, content: "今天又是想退休的一天呢，哪怕我才刚入职。" },
    { id: 110, content: "公司就像是一个大家庭，而我是那个被遗弃的孩子。" },
    { id: 111, content: "不要跟我画大饼，我胃不好，消化不了。" },
    { id: 112, content: "如果你不能给我涨薪，那就请闭上你的嘴，让我静静地发疯。" },
  ],
  romance: [
    { id: 201, content: "你走了，我的心也碎了。碎得跟饺子馅似的，还是猪肉大葱味的。" },
    { id: 202, content: "恋爱太苦了，我还是喝奶茶吧，奶茶也是苦的，那就多加点糖。" },
    { id: 203, content: "你问我爱你有多深，我也说不清，反正比马里亚纳海沟要浅那么一点点。" },
    { id: 204, content: "我以为我能感动你，结果只是感动了楼下的保安大叔。" },
    { id: 205, content: "你是我的世界，可我的世界经常停电。" },
    { id: 206, content: "深情总被辜负，所以我决定以后只做一个无情的干饭人。" },
    { id: 207, content: "你回头看看我，我不信你两眼空空。" },
    { id: 208, content: "原来爱会消失，就像我的工资一样，还没捂热就没了。" },
    { id: 209, content: "如果你一定要离开，请把我的智商还给我。" },
    { id: 210, content: "想你的时候，我会去数星星，可惜天太阴，一颗也看不见。" },
  ],
  slacking: [
    { id: 301, content: "在哪里跌倒，就在哪里躺下，顺便睡个午觉。" },
    { id: 302, content: "只要我够努力，废柴这个称号就永远属于我。" },
    { id: 303, content: "我不是在逃避困难，我只是换一个姿势迎接失败。" },
    { id: 304, content: "既然结果都一样，那过程我就怎么舒服怎么来吧。" },
    { id: 305, content: "人生苦短，及时行乐。如果不行乐，那就及时摆烂。" },
    { id: 306, content: "我的拖延症已经到了晚期，连发疯都要等到明天。" },
    { id: 307, content: "不做无谓的挣扎，是我对生活最后的敬意。" },
    { id: 308, content: "虽然我什么都没做，但我确实已经累了。" },
    { id: 309, content: "能用钱解决的问题我一个也解决不了，能用摆烂解决的问题我手到擒来。" },
    { id: 310, content: "万事开头难，中间难，结尾也难。既然都难，那就别开始了。" },
  ],
};

const CATEGORIES = [
  { 
    id: "workplace" as Category, 
    icon: Briefcase, 
    label: "职场发疯 🤯", 
    color: "#FF705D", // rgb(255, 112, 93)
    shadow: "rgba(255, 112, 93, 0.4)"
  },
  { 
    id: "romance" as Category, 
    icon: Heart, 
    label: "恋爱EMO 😭", 
    color: "#2BA0FF", // rgb(43, 160, 255)
    shadow: "rgba(43, 160, 255, 0.4)"
  },
  { 
    id: "slacking" as Category, 
    icon: Coffee, 
    label: "摆烂语录 🛌", 
    color: "#F5E211", // rgb(245, 226, 17)
    shadow: "rgba(245, 226, 17, 0.4)"
  },
];

const EMOJIS = ["💥", "🤯", "😵‍💫", "🫠", "😂", "🤪", "🔥", "💔", "🤡"];

const INITIAL_MESSAGES = [
  "这个软件救了我的命，我今天刚跟老板发完疯。",
  "恋爱EMO真的太准了，边哭边复制。",
  "建议增加‘发疯文学’到‘发疯诗集’的自动转换。",
  "摆烂语录能不能多更新一点，库存快用完了。",
  "为什么没有‘深夜emo‘专场？",
  "刚才复制给导师了，现在在被退学边缘徘徊，好评！",
  "文案很有深度，希望能出壁纸版。",
  "在这里发疯真的很治愈，感谢作者。",
];

const CHAIN_LENGTH = 10;
const SPRING = 0.2;
const FRICTION = 0.6;

function QuoteSubmissionModal({ 
  isOpen, 
  onClose, 
  activeColor, 
  currentCategory, 
  onAddQuote 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  activeColor: string;
  currentCategory: Category;
  onAddQuote: (cat: Category, content: string) => void;
}) {
  const [content, setContent] = useState("");
  const [sent, setSent] = useState(false);
  const categoryLabel = CATEGORIES.find(c => c.id === currentCategory)?.label || "文案";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onAddQuote(currentCategory, content.trim());
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setContent("");
      onClose();
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1" style={{ background: activeColor }} />
            
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2 text-white">
               📝 独门投递：{categoryLabel}
            </h2>
            
            {sent ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-8 text-center"
              >
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: `${activeColor}20` }}>
                  <CheckCircle2 size={40} style={{ color: activeColor }} />
                </div>
                <p className="font-bold text-lg text-white">“由于你发疯发得太好，已被收录！”</p>
                <p className="text-sm text-white/40 mt-2">换个姿势刷新，可能会刷到你哦</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit}>
                <p className="text-white/60 text-sm mb-4">
                  在这里写下你的真心（或者是胡言乱语），让更多人陪你一起破防。
                </p>
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="写点惊世骇俗的..."
                  className="w-full h-32 p-4 rounded-2xl bg-white/5 border-2 border-transparent focus:border-white/10 outline-none font-medium transition-all resize-none text-sm text-white placeholder:text-white/20"
                  autoFocus
                />
                <div className="flex justify-end gap-3 mt-6">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 font-bold text-white/60 hover:text-white transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-3 rounded-xl font-black text-white shadow-lg transition-all active:scale-95"
                    style={{ background: activeColor, boxShadow: `0 0 20px ${activeColor}40` }}
                  >
                    投递到库
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ContactModal({ isOpen, onClose, activeColor }: { isOpen: boolean; onClose: () => void; activeColor: string }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm bg-gray-900 border border-white/10 rounded-3xl p-10 shadow-2xl text-center overflow-hidden"
          >
            <div className={`absolute top-0 left-0 w-full h-1`} style={{ background: activeColor }} />
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: `${activeColor}20` }}>
              <Coffee size={40} style={{ color: activeColor }} />
            </div>
            <h2 className="text-2xl font-black mb-2 text-white">来找我玩吧</h2>
            <p className="text-white/60 font-medium mb-6">欢迎深夜骚扰我：</p>
            <div 
              className="p-4 rounded-2xl bg-white/5 font-black text-lg select-all mb-8 border border-white/5"
              style={{ color: activeColor }}
            >
              1191728729@qq.com
            </div>
            <button 
              onClick={onClose}
              className="w-full py-4 rounded-xl font-black text-white shadow-lg transition-transform active:scale-95"
              style={{ background: activeColor, boxShadow: `0 0 20px ${activeColor}40` }}
            >
              记住了，撤退！
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function NoiseOverlay() {
  return (
    <div 
      className="fixed inset-0 z-[1] pointer-events-none opacity-[0.04]" 
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} 
    />
  );
}

function MarqueeMessages({ messages, color }: { messages: string[]; color: string }) {
  return (
    <div className="fixed bottom-0 left-0 w-full overflow-hidden bg-black py-4 z-[40] pointer-events-none border-t border-white/10">
      <motion.div 
        className="flex whitespace-nowrap gap-12 px-6"
        animate={{ x: [0, -2000] }}
        transition={{ 
          duration: Math.max(20, messages.length * 4), 
          repeat: Infinity, 
          ease: "linear" 
        }}
      >
        {/* Triple the messages to ensure a seamless loop even with many items */}
        {[...messages, ...messages, ...messages].map((msg, i) => (
          <span key={i} className="text-sm font-black flex items-center gap-2 text-white/90">
            <Sparkles size={14} style={{ color }} /> {msg}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function SuggestionModal({ isOpen, onClose, activeColor, onAddMessage }: { 
  isOpen: boolean; 
  onClose: () => void; 
  activeColor: string;
  onAddMessage: (msg: string) => void;
}) {
  const [suggestion, setSuggestion] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!suggestion.trim()) return;
    
    // Add to marquee immediately
    onAddMessage(suggestion.trim());
    
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setSuggestion("");
      onClose();
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1" style={{ background: activeColor }} />
            
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2 text-white">
              <Sparkles className="animate-pulse" /> 投递建议
            </h2>
            
            {sent ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-8 text-center"
              >
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: `${activeColor}20` }}>
                  <CheckCircle2 size={40} style={{ color: activeColor }} />
                </div>
                <p className="font-bold text-lg text-white">收到！建议已归档到高等生物发疯清单里。</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit}>
                <p className="text-white/60 text-sm mb-4">
                  有什么想看的分类或者想吐槽的？别憋着，写下来。
                </p>
                <textarea 
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  placeholder="写点好笑的..."
                  className="w-full h-32 p-4 rounded-2xl bg-white/5 border-2 border-transparent focus:border-white/10 outline-none font-medium transition-all resize-none text-sm text-white placeholder:text-white/20"
                  autoFocus
                />
                <div className="flex justify-end gap-3 mt-6">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 font-bold text-white/60 hover:text-white transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-3 rounded-xl font-black text-white shadow-lg transition-all active:scale-95"
                    style={{ background: activeColor, boxShadow: `0 0 20px ${activeColor}40` }}
                  >
                    发送
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ElasticCursor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: -100, y: -100 });
  const points = useRef(Array.from({ length: CHAIN_LENGTH }, () => ({ x: -100, y: -100, vx: 0, vy: 0 })));

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };
    const handleTouch = (e: TouchEvent) => {
      if (e.touches[0]) {
        mousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleTouch);

    let rafId: number;
    const update = () => {
      let targetX = mousePos.current.x;
      let targetY = mousePos.current.y;

      const children = containerRef.current?.children;
      if (!children) return;

      for (let i = 0; i < points.current.length; i++) {
        const pt = points.current[i];
        
        // 为后续点添加垂直偏移，实现“垂直挂载”效果
        const currentTargetY = i === 0 ? targetY : points.current[i - 1].y + 24;
        const currentTargetX = i === 0 ? targetX : points.current[i - 1].x;

        // Spring physics
        pt.vx += (currentTargetX - pt.x) * SPRING;
        pt.vy += (currentTargetY - pt.y) * SPRING;
        pt.vx *= FRICTION;
        pt.vy *= FRICTION;
        pt.x += pt.vx;
        pt.y += pt.vy;

        // Apply to DOM directly
        const el = children[i] as HTMLElement;
        if (el) {
          el.style.transform = `translate3d(${pt.x - 12}px, ${pt.y - 12}px, 0) scale(${1 - i * 0.04})`;
          el.style.opacity = (1 - i * 0.06).toString();
        }

        // 下一个点的参考位置不再更新，因为逻辑里已经写了参考 points.current[i-1]
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleTouch);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[9999]">
      {Array.from({ length: CHAIN_LENGTH }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 left-0 text-2xl select-none will-change-transform"
          style={{ transform: 'translate3d(-100px, -100px, 0)' }}
        >
          {EMOJIS[i % EMOJIS.length]}
        </div>
      ))}
    </div>
  );
}

function WebGLBackground({ mousePos }: { mousePos: { x: number, y: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const startTime = useRef(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const vsSource = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMouse;
      
      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution;
        vec2 mouse = uMouse / uResolution;
        float dist = distance(uv, mouse);
        float wave = sin(dist * 10.0 - uTime * 2.5) * 0.3;
        float light = 0.08 / dist;
        vec3 color = 0.5 + 0.5 * cos(uTime * 0.4 + uv.xyx + vec3(0, 2, 4));
        vec3 finalColor = mix(vec3(0.02, 0.1, 0.2), color, light + wave * 0.1);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const shaderProgram = gl.createProgram();
    if (!shaderProgram) return;
    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;
    gl.attachShader(shaderProgram, vs);
    gl.attachShader(shaderProgram, fs);
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(shaderProgram, "aPosition");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const utime = gl.getUniformLocation(shaderProgram, "uTime");
    const ures = gl.getUniformLocation(shaderProgram, "uResolution");
    const umouse = gl.getUniformLocation(shaderProgram, "uMouse");

    const render = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      
      gl.uniform2f(ures, canvas.width, canvas.height);
      gl.uniform2f(umouse, mousePos.x, canvas.height - mousePos.y);
      gl.uniform1f(utime, (Date.now() - startTime.current) / 1000);
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [mousePos]);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />;
}

function HeaderEmoji({ mousePos }: { mousePos: { x: number, y: number } }) {
  const moveX = (window.innerWidth / 2 - mousePos.x) / 40;
  const moveY = (window.innerHeight / 2 - mousePos.y) / 40;

  return (
    <div className="relative inline-block mb-12">
      <div 
        className="text-[6rem] sm:text-[8rem] relative z-10 transition-transform duration-300 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]"
        style={{ transform: `translate(${moveX}px, ${moveY}px)` }}
      >
        🌞🌑
      </div>
      <div 
        className="absolute -bottom-16 left-0 w-full text-[6rem] sm:text-[8rem] opacity-20 blur-[2px] pointer-events-none select-none"
        style={{ 
          transform: `scaleY(-1) translate(${moveX}px, ${-moveY}px)`,
          maskImage: 'linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.8))',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.8))'
        }}
      >
        🌞🌑
      </div>
    </div>
  );
}

function FlyingShouts({ shouts }: { shouts: Shout[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[90] overflow-hidden">
      <AnimatePresence>
        {shouts.map((shout) => (
          <motion.div
            key={shout.id}
            initial={{ x: "110vw", opacity: 0 }}
            animate={{ x: "-110vw", opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shout.speed, ease: "linear" }}
            className="absolute whitespace-nowrap text-3xl font-black italic tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]"
            style={{ 
              top: `${shout.y}%`, 
              color: shout.color,
              textShadow: `0 0 20px ${shout.color}80`
            }}
          >
            {shout.content}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [guestId] = useState(getGuestId);
  const [activeCategory, setActiveCategory] = useState<Category>("workplace");
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isQuoteSubmitOpen, setIsQuoteSubmitOpen] = useState(false);
  const [quotesData, setQuotesData] = useState<Record<Category, Quote[]>>(INITIAL_QUOTES);
  const [messages, setMessages] = useState<string[]>(INITIAL_MESSAGES);
  const historyKey = 'madness_view_history';
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const viewHistory = useRef<Record<Category, (string | number)[]>>((() => {
    try {
      const saved = localStorage.getItem(historyKey);
      return saved ? JSON.parse(saved) : { workplace: [], romance: [], slacking: [] };
    } catch {
      return { workplace: [], romance: [], slacking: [] };
    }
  })());

  // Save history whenever it changes
  useEffect(() => {
    localStorage.setItem(historyKey, JSON.stringify(viewHistory.current));
  }, [currentQuote]);

  // Firestore Synchronizers
  useEffect(() => {
    const q = query(collection(db, "quotes"), orderBy("createdAt", "desc"), limit(200));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[Firestore] Received ${snapshot.size} quotes from clouds.`);
      const newQuotes: Record<Category, Quote[]> = {
        workplace: [...INITIAL_QUOTES.workplace],
        romance: [...INITIAL_QUOTES.romance],
        slacking: [...INITIAL_QUOTES.slacking]
      };
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const cat = data.category as Category;
        if (newQuotes[cat]) {
          // Add to the front so they are prioritized
          newQuotes[cat].unshift({ id: doc.id, content: data.content });
        }
      });
      setQuotesData(newQuotes);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "quotes"));

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMsgs: string[] = [];
      const newShouts: Shout[] = [];

      snapshot.docChanges().forEach(change => {
        if (change.type === "added") {
          const data = change.doc.data();
          const createdAt = (data.createdAt as Timestamp)?.toMillis();
          
          const isRecent = createdAt ? (Date.now() - createdAt < 10000) : true;
          const isNotMe = data.authorId !== guestId;

          if (isRecent && isNotMe) {
            const newShout: Shout = {
              id: change.doc.id,
              content: data.content,
              color: data.color || "#ffffff",
              y: Math.random() * 50 + 20,
              speed: Math.random() * 6 + 10
            };
            newShouts.push(newShout);
          }
        }
      });

      if (newShouts.length > 0) {
        setShouts(prev => [...prev, ...newShouts]);
        newShouts.forEach(s => {
          setTimeout(() => {
            setShouts(prev => prev.filter(ps => ps.id !== s.id));
          }, 18000);
        });
      }
      
      snapshot.docs.forEach(doc => {
        newMsgs.push(doc.data().content);
      });
      setMessages(newMsgs.length > 0 ? newMsgs : INITIAL_MESSAGES);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "messages"));

    return () => unsubscribe();
  }, [guestId]);

  const activeColor = CATEGORIES.find(c => c.id === activeCategory)?.color || "#d63384";
  const activeShadow = CATEGORIES.find(c => c.id === activeCategory)?.shadow || "rgba(214, 51, 132, 0.3)";

  // --- Logic ---
  const generateNewQuote = useCallback(() => {
    setIsRefreshing(true);
    const categoryQuotes = quotesData[activeCategory];
    
    if (categoryQuotes.length === 0) {
      setCurrentQuote({ id: 0, content: "暂无文案，快去投递吧！" });
      setIsRefreshing(false);
      return;
    }

    // Smart Randomization: Filter out recently viewed quotes
    const history = viewHistory.current[activeCategory];
    
    // Separate user quotes (string IDs) from initial quotes (number IDs)
    const userQuotes = categoryQuotes.filter(q => typeof q.id === 'string');
    const systemQuotes = categoryQuotes.filter(q => typeof q.id === 'number');

    // Priority: Try to pick from user quotes first if not in history
    let availableUserQuotes = userQuotes.filter(q => !history.includes(q.id) && q.id !== currentQuote?.id);
    let availableSystemQuotes = systemQuotes.filter(q => !history.includes(q.id) && q.id !== currentQuote?.id);

    let newQuote: Quote;

    // 70% chance to pick user content if available, else system content
    if (availableUserQuotes.length > 0 && Math.random() < 0.7) {
      newQuote = availableUserQuotes[Math.floor(Math.random() * availableUserQuotes.length)];
    } else if (availableSystemQuotes.length > 0) {
      newQuote = availableSystemQuotes[Math.floor(Math.random() * availableSystemQuotes.length)];
    } else if (availableUserQuotes.length > 0) {
      newQuote = availableUserQuotes[Math.floor(Math.random() * availableUserQuotes.length)];
    } else {
      // Emergency: reset history
      viewHistory.current[activeCategory] = currentQuote ? [currentQuote.id] : [];
      newQuote = categoryQuotes.find(q => q.id !== currentQuote?.id) || categoryQuotes[0];
    }
    
    // Update history
    if (newQuote) {
      viewHistory.current[activeCategory].push(newQuote.id);
      const maxHistory = Math.floor(categoryQuotes.length * 0.8);
      if (viewHistory.current[activeCategory].length > maxHistory) {
        viewHistory.current[activeCategory].shift();
      }
    }

    setTimeout(() => {
      setCurrentQuote(newQuote);
      setIsRefreshing(false);
    }, 200);
  }, [activeCategory, currentQuote, quotesData]);

  const addMessage = async (msg: string) => {
    try {
      const docRef = await addDoc(collection(db, "messages"), {
        content: msg,
        color: activeColor,
        authorId: guestId,
        createdAt: serverTimestamp()
      });
      const localShout: Shout = {
        id: "local-" + docRef.id,
        content: msg,
        color: activeColor,
        y: Math.random() * 50 + 20,
        speed: 12
      };
      setShouts(prev => [...prev, localShout]);
      setTimeout(() => {
        setShouts(prev => prev.filter(s => s.id !== localShout.id));
      }, 15000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "messages");
    }
  };

  const addQuote = async (cat: Category, content: string) => {
    try {
      const docRef = await addDoc(collection(db, "quotes"), {
        content,
        category: cat,
        authorId: guestId,
        createdAt: serverTimestamp()
      });
      setCurrentQuote({ id: docRef.id, content });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "quotes");
    }
  };

  const logout = () => {};

  useEffect(() => {
    generateNewQuote();
  }, [activeCategory]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const copyToClipboard = async () => {
    if (!currentQuote) return;
    try {
      await navigator.clipboard.writeText(currentQuote.content);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <div 
      className="min-h-screen selection:bg-white/20 selection:text-white font-sans text-white p-4 md:p-8 flex items-center justify-center overflow-x-hidden relative"
      style={{ backgroundColor: '#0a0a0a' }}
    >
      {/* WebGL Cosmic Shader Background */}
      <WebGLBackground mousePos={mousePos} />
      
      {/* Noise Texture */}
      <NoiseOverlay />

      {/* Flying Shouts Layer */}
      <FlyingShouts shouts={shouts} />

      {/* Elastic Emoji Cursor */}
      <ElasticCursor />

      <div className="w-full max-w-[600px] flex flex-col items-center relative z-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-[40px] relative z-20"
        >
          <HeaderEmoji mousePos={mousePos} />
          <h1 className="text-[2.2rem] sm:text-[3rem] font-black tracking-[-3px] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] mb-2 mt-4">
            👻你好，疯友
          </h1>
          <p className="text-[1rem] text-white/60 font-medium tracking-wide">
             伶曰：“我以天地为栋宇，
             屋室为裈衣，
             诸君何为入我裈中！
          </p>
        </motion.div>

        {/* Tab Container */}
        <div className="bg-white/5 backdrop-blur-md p-2 rounded-full flex gap-[10px] mb-8 shadow-2xl w-fit mx-auto border border-white/10 relative z-20">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`
                  relative px-6 py-3 rounded-full text-[1rem] font-black transition-all duration-300 group
                `}
                style={{
                  color: isActive ? 'white' : 'rgba(255,255,255,0.4)'
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    style={{ background: cat.color }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">
                  {cat.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Quote Card */}
        <motion.div
          id="main-card"
          className="w-full bg-black/40 backdrop-blur-xl rounded-[40px] p-[60px_40px] shadow-[0_0_50px_rgba(0,0,0,0.8)] relative border border-white/10 min-h-[300px] flex items-center justify-center overflow-visible cursor-default"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -6, boxShadow: "0 0 80px rgba(0,0,0,1)" }}
          transition={{ duration: 0.5 }}
        >
          {/* Quote Icons */}
          <span 
            className="absolute top-6 left-8 text-[80px] leading-none opacity-[0.1] font-serif pointer-events-none select-none"
            style={{ color: "white" }}
          >“</span>
          <span 
            className="absolute -bottom-6 right-8 text-[80px] leading-none opacity-[0.1] font-serif rotate-180 pointer-events-none select-none"
            style={{ color: "white" }}
          >“</span>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuote?.id || "loading"}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className="relative z-10 text-center"
            >
              <p className="text-[1.5rem] sm:text-[1.8rem] leading-[1.6] font-sans font-black text-white text-center max-w-[95%] mx-auto antialiased drop-shadow-lg italic">
                {currentQuote ? currentQuote.content : "光影交织中..."}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mt-[30px] w-full sm:w-auto sm:justify-center items-center">
          <motion.button
            whileTap={{ 
              scale: 0.92,
              x: [0, -10, 10, -10, 10, 0], // Crazy shake
              rotate: [0, -2, 2, -2, 2, 0]
            }}
            onClick={generateNewQuote}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 text-white font-black py-[14px] px-[28px] rounded-[16px] shadow-lg transition-all disabled:opacity-50 min-w-[160px] uppercase italic text-lg"
            style={{ background: activeColor, boxShadow: `0 8px 25px ${activeShadow}` }}
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            🤠换个姿势
          </motion.button>

          <div className="flex gap-4">
            <motion.button
              whileTap={{ 
                scale: 0.92,
                x: [0, 5, -5, 5, -5, 0], // Shakes
              }}
              onClick={copyToClipboard}
              className="flex items-center justify-center gap-2 font-black py-[14px] px-[24px] rounded-[16px] transition-all text-base border border-white/20 bg-white/5 backdrop-blur-md text-white hover:bg-white/10"
            >
              <Copy size={18} />
              🫣一键复制
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setIsQuoteSubmitOpen(true)}
              className="flex items-center justify-center gap-2 font-black py-[14px] px-[24px] rounded-[16px] transition-all text-white shadow-md text-base"
              style={{ background: activeColor }}
            >
              <Plus size={18} />
              🙂‍↕️我要投递
            </motion.button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center space-y-4 pb-12">
          <div className="flex items-center justify-center gap-8 opacity-60 hover:opacity-100 transition-opacity">
            <motion.button 
              whileHover={{ y: -2, color: activeColor }}
              onClick={() => setIsSuggestionOpen(true)}
              className="text-white flex items-center gap-2 text-xs font-black uppercase tracking-widest"
            >
              <MessageCircle size={16} /> 发弹幕👋🏼
            </motion.button>
            <motion.button 
              whileHover={{ y: -2, color: activeColor }}
              onClick={() => setIsContactOpen(true)}
              className="text-white flex items-center gap-2 text-xs font-black uppercase tracking-widest"
            >
              <Coffee size={16} /> 深夜骚扰通道
            </motion.button>
          </div>
          <p className="text-[0.8rem] text-white/40 font-medium pb-10">
            全网已累计解决 1,408,231 个不开心时刻 <br/>
            生活已经很苦了，发点疯也没关系
            @2026WYP
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.5, rotate: -20 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: -100, scale: 1.5, rotate: 20 }}
            className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-[200] bg-gray-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex flex-col items-center gap-2"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="text-4xl"
            >
              🌀
            </motion.div>
            <span className="font-black text-xl text-center">
              复制成功！<br/>已然疯度翩翩！
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Quote Submission Modal */}
      <QuoteSubmissionModal
        isOpen={isQuoteSubmitOpen}
        onClose={() => setIsQuoteSubmitOpen(false)}
        activeColor={activeColor}
        currentCategory={activeCategory}
        onAddQuote={addQuote}
      />

      {/* Suggestion Modal */}
      <SuggestionModal 
        isOpen={isSuggestionOpen} 
        onClose={() => setIsSuggestionOpen(false)} 
        activeColor={activeColor} 
        onAddMessage={addMessage}
      />

      {/* Contact Modal */}
      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        activeColor={activeColor}
      />

      {/* Footer Marquee */}
      <MarqueeMessages messages={messages} color={activeColor} />
    </div>
  );
}
