import Yoga from 'yoga-layout';
try {
  const node = Yoga.Node.create();
  console.log('Success: Node created');
  console.log('Node methods:', Object.keys(Object.getPrototypeOf(node)));
} catch (e) {
  console.error('Error:', e);
}
