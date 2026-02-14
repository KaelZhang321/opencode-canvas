import initYoga from 'yoga-layout';
(async () => {
  const Yoga = await initYoga();
  const node = Yoga.Node.create();
  node.setWidth(100);
  console.log('Node width:', node.getWidth());
})();
