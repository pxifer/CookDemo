"""Contract tests only: no weights, network, torch import or real embeddings."""
import threading
import unittest
from runtime import Encoder

class Array:
    def tolist(self): return [[0.6, 0.8]]
class FakeModel:
    def __init__(self): self.seen = None
    def tokenizer(self, text, **options):
        assert options['truncation'] is False
        return {'input_ids': list(range(len(text)))}
    def encode(self, text, **options):
        self.seen = (text, options)
        assert options['prompt'] == ''
        return Array()

class RuntimeContract(unittest.TestCase):
    def fixture(self, instruction='Instruct: task\nQuery: '):
        encoder = Encoder.__new__(Encoder)
        encoder.model = FakeModel()
        encoder.identity = {'queryInstruction':instruction,'dimensions':2}
        encoder.max_tokens = 100
        encoder.inference_lock = threading.Lock()
        return encoder
    def test_role_instruction_and_no_silent_truncation(self):
        encoder = self.fixture()
        result = encoder.encode(['evidence'],'document')
        self.assertEqual(encoder.model.seen[0],['evidence'])
        self.assertEqual(result['tokenCounts'],[8])
        encoder.encode(['question'],'query')
        self.assertTrue(encoder.model.seen[0][0].startswith('Instruct:'))
        encoder.max_tokens = 2
        with self.assertRaisesRegex(ValueError,'TOO_LONG'): encoder.encode(['evidence'],'document')
    def test_invalid_batch_and_bge_no_old_instruction(self):
        encoder = self.fixture('')
        with self.assertRaisesRegex(ValueError,'INVALID'): encoder.encode([],'query')
        with self.assertRaisesRegex(ValueError,'INVALID'): encoder.encode([''],'query')
        encoder.encode(['query'],'query')
        self.assertEqual(encoder.model.seen[0],['query'])

if __name__ == '__main__': unittest.main()
