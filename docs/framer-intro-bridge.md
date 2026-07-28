# Framer 开屏动画接入契约

站点保持原生 JavaScript 架构，不直接加载 Framer 或 React 运行库。开屏动画构建完成后，
由独立动画包把 Framer/React 组件挂载到 `#intro-motion-root`：

```js
TravelRollsIntro.mount((root, { complete }) => {
  const reactRoot = createRoot(root);
  reactRoot.render(<TravelIntro onAnimationComplete={complete} />);
  return () => reactRoot.unmount();
});
```

动画包必须：

- 动画结束或跳过时调用 `complete()`；
- 返回卸载函数，确保路由刷新或重复播放时释放 React root；
- 不直接改写 `.site-frame`；
- 遵守 `prefers-reduced-motion`。桥接层默认在用户要求减少动态效果时跳过开屏；
- 监听 `travelrolls:intro-ready` 后再挂载，或在脚本加载后直接检查
  `window.TravelRollsIntro`；
- 如需重新播放，可再次调用 `mount()`；桥接层会先清理上一次实例。

可用生命周期事件：

- `travelrolls:intro-ready`
- `travelrolls:intro-mounted`
- `travelrolls:intro-complete`
- `travelrolls:intro-skipped`
