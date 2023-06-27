import numpy as np
import re
import copy
from functools import partial
import Levenshtein
from gensim.test.utils import datapath
from gensim.models.fasttext import load_facebook_vectors
from gensim.models import KeyedVectors
import compress_fasttext
import spacy
from scipy.spatial import distance
from sentence_transformers import SentenceTransformer
nlp = spacy.load("sv_core_news_lg")
import sv_core_news_lg
nlp = sv_core_news_lg.load()

models_folder_path = "/somepath/"

enabled_models = {
  "fasttext": (True, "gensim"),
  "word2vec": (False, "gensim"),
  "spacy": (True, "spacy"),
  "sentence_bert": (True, "sentence_bert")
}

class dot_dict(dict):
    # some credit: https://stackoverflow.com/questions/2352181/how-to-use-a-dot-to-access-members-of-dictionary
    """dot.notation access to dictionary attributes"""
    __getattr__ = dict.get
    __setattr__ = dict.__setitem__
    __delattr__ = dict.__delitem__

    def init(self, obj, key, random=False):
      if key not in self.keys():
        if type(obj) is dict:
          if random:
            sub_dict = dot_dict_random_list(obj)
          else:
            sub_dict = dot_dict(obj)
          self.__setitem__(key, sub_dict)
        else:
          self.__setitem__(key, obj)

    def overwrite(self, obj, key, random=False):
      if type(obj) is dict:
        if random:
          sub_dict = dot_dict_random_list(obj)
        else:
          sub_dict = dot_dict(obj)
        self.__setitem__(key, sub_dict)
      else:
        self.__setitem__(key, obj)

class dot_dict_random_list(dict):
    # some credit: https://stackoverflow.com/questions/2352181/how-to-use-a-dot-to-access-members-of-dictionary
    """dot.notation access to dictionary attributes"""
    def get_random(self, key):
      num_entries = len(self[key])
      index = np.random.choice(num_entries, replace=False)
      return self[key][index]

    __getattr__ = get_random
    __setattr__ = dict.__setitem__
    __delattr__ = dict.__delitem__

    def init(self, obj, key):
      if key not in self.keys():
        if type(obj) is dict:
          sub_dict = dot_dict(obj)
          self.__setitem__(key, sub_dict)
        else:
          self.__setitem__(key, obj)

global_func = dot_dict({})

def get_most_frequent_value(arr):
  return np.unique(arr)[np.argmax(np.unique(arr, return_counts=True)[1])]

def cosine_similarity(w1, w2):
  return 1 - distance.cosine(w1, w2)

def filter_if_all_equal_extract(obj, conf={"collection_key": "similarity", "extraction_key": "index"}):
  new_obj = {}
  arr = []

  for key in obj.keys():
    last_val = None
    for val in obj[key][conf["collection_key"]]:
      if last_val is not None and not abs(last_val - val) < 0.00001:
        last_val = None
        break
      else:
        last_val = val

    if last_val is None:
      arr.append(obj[key][conf["extraction_key"]])
      new_obj[key] = copy.deepcopy(obj[key])

  return new_obj, arr

def get_majority_vote(similarities, threshold=0.5):
  similarities_filtered, votes = filter_if_all_equal_extract(similarities)
  majority_vote = get_most_frequent_value(votes)

  sim_len = len(similarities_filtered[list(similarities_filtered.keys())[0]]["similarity"])
  majority_vote_mean = [[] for l in range(sim_len)]
  vote_mean = []

  for key in similarities_filtered.keys():
    for i, val in enumerate(similarities_filtered[key]["similarity"]):
      majority_vote_mean[i].append(val)

  for i in range(len(majority_vote_mean)):
    vote_mean.append(np.mean(majority_vote_mean[i]))

  above_threshold = True
  for key in similarities_filtered.keys():
    if similarities_filtered[key]["similarity"][majority_vote] < threshold:
      above_threshold = False
      break

  return majority_vote, np.argmax(vote_mean), above_threshold

def get_majority_vote_vs_collections(similarities_1, similarities_2, threshold=0.5):
  similarities_1_filtered, _ = filter_if_all_equal_extract(similarities_1)
  similarities_2_filtered, _ = filter_if_all_equal_extract(similarities_2)

  mean_max_1 = {}
  mean_max_2 = {}
  votes = {"max": [], "mean": [], "all": {}}
  for key in similarities_1_filtered.keys():
    mean_max_1[key] = {}
    mean_max_2[key] = {}
    votes[key] = {}
    mean_max_1[key]["max"] = np.max(similarities_1_filtered[key]["similarity"])
    mean_max_1[key]["mean"] = np.mean(similarities_1_filtered[key]["similarity"])
    mean_max_2[key]["max"] = np.max(similarities_2_filtered[key]["similarity"])
    mean_max_2[key]["mean"] = np.mean(similarities_2_filtered[key]["similarity"])
    votes[key]["max"] = 0 if mean_max_1[key]["max"] > mean_max_2[key]["max"] else 1
    votes[key]["mean"] = 0 if mean_max_1[key]["mean"] > mean_max_2[key]["mean"] else 1
    votes["max"].append(0 if mean_max_1[key]["max"] > mean_max_2[key]["max"] else 1)
    votes["mean"].append(0 if mean_max_1[key]["mean"] > mean_max_2[key]["mean"] else 1)

  majority_max = get_most_frequent_value(votes["max"])
  majority_mean = get_most_frequent_value(votes["mean"])
  votes["all"]["max"] = majority_max
  votes["all"]["mean"] = majority_mean
  votes["all"]["max_agree"] = len(np.unique(votes["max"])) == 1
  votes["all"]["mean_agree"] = len(np.unique(votes["mean"])) == 1

  max_above_thres = True
  mean_above_thres = True
  for key in mean_max_1.keys():
    if majority_max == 0:
      if mean_max_1[key]["max"] < threshold:
        max_above_thres = False
      if mean_max_1[key]["mean"] < threshold:
        mean_above_thres = False
    else:
      if mean_max_2[key]["max"] < threshold:
        max_above_thres = False
      if mean_max_2[key]["mean"] < threshold:
        mean_above_thres = False

  return majority_max, majority_mean, votes["all"]["max_agree"], votes["all"]["mean_agree"], max_above_thres, mean_above_thres

def get_majority_vote_vs_collections_many(similarities, threshold=0.5):
  similarities_filtered = [filter_if_all_equal_extract(col)[0] for col in similarities]

  mean_max = [{} for col in similarities]
  votes = {"max": [], "mean": [], "max_val": [], "mean_val": [], "all": {}}

  for i, col in enumerate(similarities_filtered):
    for key in similarities_filtered[0].keys():
      mean_max[i][key] = {}
      mean_max[i][key]["max"] = np.max(similarities_filtered[i][key]["similarity"])
      mean_max[i][key]["mean"] = np.mean(similarities_filtered[i][key]["similarity"])

  for key in similarities_filtered[0].keys():
    max_val_max = -2
    max_val_mean = -2
    index_max = 0
    index_mean = 0

    for i, col in enumerate(similarities_filtered):
      if mean_max[i][key]["max"] > max_val_max:
        max_val_max = mean_max[i][key]["max"]
        index_max = i
      if mean_max[i][key]["mean"] > max_val_mean:
        max_val_mean = mean_max[i][key]["mean"]
        index_mean = i

    votes["max"].append(index_max)
    votes["mean"].append(index_mean)
    votes["max_val"].append(max_val_max)
    votes["mean_val"].append(max_val_mean)

  majority_max = get_most_frequent_value(votes["max"])
  majority_mean = get_most_frequent_value(votes["mean"])
  max_agrees = len(np.unique(votes["max"])) == 1
  mean_agrees = len(np.unique(votes["mean"])) == 1
  max_above_thres = True
  mean_above_thres = True
  
  for i in range(len(votes["max_val"])):
    if votes["max_val"][i] < threshold:
      max_above_thres = False
    if votes["mean_val"][i] < threshold:
      mean_above_thres = False

  return majority_max, majority_mean, max_agrees, mean_agrees, max_above_thres, mean_above_thres

def manipulate_response(msg, replace):
  pattern = "\$\$[0-9]"
  pattern_index = "\$\$([0-9])"
  all_matches = re.findall(pattern, msg)
  all_matches_index = re.findall(pattern_index, msg)
  all_matches_index = [int(m) - 1 for m in all_matches_index]
  adjusted_msg = msg

  assert len(replace) - 1 >= max(all_matches_index)

  for i in all_matches_index:
    adjusted_msg = re.sub(pattern, replace[i], adjusted_msg, count=1)

  return adjusted_msg

def msg_is_manipulable(msg):
  pattern = "\$\$[0-9]"
  res = re.search(pattern, msg)
  return res is not None

def msg_is_manipulable_and_expandable(msg):
  pattern = "\$\$\$"
  res = re.search(pattern, msg)
  return res is not None

def manipulate_and_expand_response(msg, expansion_list):
  pattern = "\$\$\$"
  to_replace = ""
  for s in expansion_list:
    to_replace += s + ", "
  to_replace = to_replace[:len(to_replace) - 2]
  adjusted_msg = msg

  adjusted_msg = re.sub(pattern, to_replace, adjusted_msg, count=1)

  return adjusted_msg

def list_to_comma_separated_segment(word_list):
  final_string = ""

  if len(word_list) == 1:
    return word_list[0]

  for i, word in enumerate(word_list):
    if not i == len(word_list) - 1:
      final_string += word + ", " if i != len(word_list) - 2 else word + " "
    else:
      final_string += "och " + word

  return final_string

def calculate_extraction_duration(texts):
  count = 0
  avg_sentence_duration = 0.0363

  for text in texts:
    count += len(text.split("."))

  return round(count * avg_sentence_duration)

def load_word_embeddings(enabled_models):
  fasttext_model = None
  word2vec_model = None
  sentence_bert_model = None

  if enabled_models["fasttext"][0]:
    path_fasttext = datapath(models_folder_path + "cc.sv.300.bin")
    fasttext_model = load_facebook_vectors(path_fasttext)
    #fasttext_model = compress_fasttext.models.CompressedFastTextKeyedVectors.load(models_folder_path + "cc.sv.300.pruned.bin")

  if enabled_models["word2vec"][0]:
    path_word2vec = datapath(models_folder_path + "word2vec.sv.100.conll17.bin")
    word2vec_model = KeyedVectors.load_word2vec_format(path_word2vec, binary=True)

  if enabled_models["sentence_bert"][0]:
    sentence_bert_model = SentenceTransformer('KBLab/sentence-bert-swedish-cased')

  return fasttext_model, word2vec_model, sentence_bert_model

def compare_word_similarity(models, input_word, base_word, exclude_models=[]):
  def debug_output(model, input_w, base_w):
    if " " in input_w:
      print("INPUT WORD TYPE: phrase / in model")
      ws = input_w.split(" ")
      for w in ws:
        print(w, w in model.key_to_index if model else "", " " in input_w)
    else:
      print("INPUT WORD TYPE: word / in model")
      print(input_w, input_w in model.key_to_index if model else "")

    if type(base_w) is str:
      print("BASE WORD PARAMETER TYPE: string / in model")
      print(base_w, base_w in model.key_to_index if model else "")
    else:
      print("BASE WORD PARAMETER TYPE: list / in model")
      for bw in base_word:
        print(bw, bw in model.key_to_index if model else "")

    assert type(base_word) is list or type(base_word) is str

  def compare_gensim(model, input_w, base_w, get_phrase_embedding):
    if type(base_w) is str:
      if " " in input_w:
        input_word_vec = get_phrase_embedding(input_w)
        base_word_vec = model.get_vector(base_w)
        similarity = model.cosine_similarities(input_word_vec, base_word_vec)[0]

        return similarity, None
      else:
        similarity = model.similarity(input_w, base_w)

        return similarity, None
    else:
      if " " in input_w:
        input_word_vec = get_phrase_embedding(input_w)
        base_words_vecs = []

        for b_word in base_w:
          base_words_vecs.append(model.get_vector(b_word))

        similarities = model.cosine_similarities(input_word_vec, base_words_vecs)
        max_similarity_index = np.argmax(similarities)

        return similarities, max_similarity_index
      else:
        similarities = []

        for b_word in base_w:
          similarities.append(model.similarity(input_w, b_word))
        max_similarity_index = np.argmax(similarities)

        return similarities, max_similarity_index

  def compare_spacy(model, input_w, base_w):
    if type(base_w) is str:
      doc_input = nlp(input_w)
      doc_base = nlp(base_w)
      similarity = doc_input.similarity(doc_base)

      return similarity, None
    else:
      doc_input = nlp(input_word)
      base_words_vecs = []
      similarities = []

      for i, b_word in enumerate(base_w):
        base_words_vecs.append(nlp(b_word))
        similarities.append(doc_input.similarity(base_words_vecs[i]))
      max_similarity_index = np.argmax(similarities)

      return similarities, max_similarity_index

  def compare_sentence_bert(model, input_w, base_w):
    embeddings_input = model.encode(input_w)

    if type(base_w) == str:
      embeddings_base = model.encode(base_w)
      similarity = cosine_similarity(embeddings_input, embeddings_base)

      return similarity, None
    else:
      embeddings_base = [model.encode(b) for b in base_w]
      similarities = []

      for i, emb_out in enumerate(embeddings_base):
        similarities.append(cosine_similarity(embeddings_input, emb_out))

      max_similarity_index = np.argmax(similarities)

      return similarities, max_similarity_index

  if "fasttext" in models.keys() or "word2vec" in models.keys():
    debug_output(None, input_word, base_word)

  all_similarities = {}

  for key in models["enabled"].keys():
    if key in exclude_models:
      continue

    model_type = models["enabled"][key]
    model = None

    if key in models.keys():
      model = models[key]["model"]

    if model_type == "gensim":
      similarities, max_similarity_index = compare_gensim(model, input_word, base_word, models[key]["phrase_similarity"])
    elif model_type == "spacy":
      similarities, max_similarity_index = compare_spacy(model, input_word, base_word)
    elif model_type == "sentence_bert":
      similarities, max_similarity_index = compare_sentence_bert(model, input_word, base_word)

    all_similarities[key] = {"similarity": similarities, "index": max_similarity_index}

  return all_similarities

def word_collection_similarity(word, collection):
  results = []

  for col in collection:
    all_similarities = word_similarity(word, col)
    results.append(all_similarities)

  majority_vote = {"max": [], "mean": []}
  index_all_all = []
  max_all_all = []
  mean_all_all = []
  median_all_all = []
  similar = {key: {"max": [], "mean":[]} for key in results[0].keys()}
  
  for i, col in enumerate(collection):
    index_all = []
    max_all = []
    mean_all = []
    median_all = []

    for key in results[i].keys():
      index = results[i][key]["index"]
      max_val = np.max(results[i][key]["similarity"])
      mean_val = np.mean(results[i][key]["similarity"])
      median_val = np.median(results[i][key]["similarity"])
      index_all.append(index)
      max_all.append(max_val)
      mean_all.append(mean_val)
      median_all.append(median_val)
      similar[key]["max"].append(max_val)
      similar[key]["mean"].append(mean_val)

    max_all_all += max_all
    mean_all_all += mean_all
    median_all_all += median_all_all

  for key in similar.keys():
    max_val = np.argmax(similar[key]["max"])
    mean_val = np.argmax(similar[key]["mean"])
    majority_vote["max"].append(max_val)
    majority_vote["mean"].append(mean_val)

  index_max = get_most_frequent_value(majority_vote["max"])
  index_mean = get_most_frequent_value(majority_vote["mean"])

  return index_max, index_mean

# compares semantic similarity of in_q (input question) to base_q (collection of questions), if ensemble is False bert only otherwise also spacy
# if ensemble is false bert threshold applies and it returns maximum index above said threshold, otherwise it looks for agreement between the two models that are above the both threshold,
# if agreement does not exist it looks at bert scores in descending order returns any index where both models remains above the both threshold if such match exists, otherwise it returns -1
def compare_question_similarity(model, in_q, base_q, ensemble=True, threshold={"spacy": 0.7, "bert": 0.7, "both": 0.6}):
  similarity_spacy = []
  similarity_bert = []
  input_bert = model.encode(in_q)

  if not ensemble:
    thres = threshold["bert"]

    for q in base_q:
      similarity_bert.append(cosine_similarity(input_bert, model.encode(q)))

    max_index = np.argmax(similarity_bert)

    return max_index if similarity_bert[max_index] > thres else -1

  input_spacy = nlp(in_q)
  for q in base_q:
    similarity_bert.append(cosine_similarity(input_bert, model.encode(q)))
    similarity_spacy.append(input_spacy.similarity(nlp(q)))

  max_bert = np.argmax(similarity_bert)
  max_spacy = np.argmax(similarity_spacy)

  if max_bert == max_spacy and similarity_bert[max_bert] > threshold["both"] and similarity_spacy[max_spacy] > threshold["both"]:
    return max_bert

  max_bert_val = similarity_bert[max_bert]
  max_index = -1

  while max_bert_val > threshold["both"]:
    if similarity_spacy[max_bert] > threshold["both"]:
      max_index = max_bert
      break

    similarity_bert[max_bert] = -2
    max_bert = np.argmax(similarity_bert)
    max_bert_val = similarity_bert[max_bert]

  return max_index


def extract_most_relevant_text_part(model, text, question, extraction_length=10, moving_average=1):
  text_sentences = text.split(".")
  pointer = 0
  cache = []
  similarities = []
  input_bert = model.encode(question)

  if moving_average == 1:
    last_index = len(text_sentences)

    while pointer < last_index:
      similarities.append(cosine_similarity(input_bert, model.encode(text_sentences[pointer])))
      pointer += 1
  else:
    if len(text_sentences) < extraction_length:
      return text

    if len(text_sentences) < moving_average:
      moving_average = extraction_length

    last_index = len(text_sentences) - 1 - moving_average
    while pointer < last_index:
      if pointer == 0:
        for i in range(moving_average):
          cache.append(cosine_similarity(input_bert, model.encode(text_sentences[i])))
        similarities.append(np.mean(cache))
        pointer = 1
      else:
        cache = cache[1:]
        cache.append(cosine_similarity(input_bert, model.encode(text_sentences[pointer + moving_average - 1])))
        similarities.append(np.mean(cache))
        pointer += 1

  max_similarity = np.max(similarities)
  max_similarity_index = np.argmax(similarities)

  if max_similarity_index > len(text_sentences) - extraction_length - 1:
    max_similarity_index = len(text_sentences) - extraction_length - 1

  # FIX TEXT
  text_extraction = ".".join(text_sentences[max_similarity_index:max_similarity_index + extraction_length + 1])
  text_extraction = text_extraction.strip()
  text_extraction += "."

  return text_extraction, max_similarity, max_similarity_index

def extract_most_relevant_text_part_from_collection(text_collection, question, extraction_length=10, moving_average=1):
  max_sim = -2
  max_sim_index = -1
  best_extraction = ""

  for i, text in enumerate(text_collection):
    text_extraction, max_similarity, max_similarity_index = extract_most_relevant_text_part(sentence_bert_model, text, question, extraction_length, moving_average)

    if (max_similarity > max_sim):
      best_extraction = text_extraction
      max_sim = max_similarity
      max_sim_index = i

  return best_extraction, max_sim, max_sim_index

def most_similar_problems(problem_id, problems, cutoff=3, max_matches=5):
  if type(problem_id) == int:
    problem_id = str(problem_id)

  problem_ids = []
  problem_ids_map = {}
  problem_dist_map = {(dist + 1): [] for dist in range(cutoff)}
  matches = []

  for problem in problems:
    p_id = problem["p"]["id"]

    if type(p_id) == int:
      p_id = str(p_id)

    problem_ids.append(p_id)
    dist = Levenshtein.distance(problem_id, p_id)
    problem_ids_map[p_id] = dist

    if dist <= cutoff:
      problem_dist_map[dist].append(p_id)

  sorted_keys = sorted(problem_dist_map.keys())
  done = False
  for key in sorted_keys:
    for id_num in problem_dist_map[key]:
      if len(matches) == max_matches:
        done = True
        break

      matches.append(id_num if type(id_num) == str else str(id_num))

    if done:
      break

  return matches

global_func.manipulate_msg = manipulate_response
global_func.manipulate_and_expand_msg = manipulate_and_expand_response
global_func.is_manipulable = msg_is_manipulable
global_func.is_manipulable_and_expandable = msg_is_manipulable_and_expandable
global_func.list_to_comma_separated_segment = list_to_comma_separated_segment
global_func.calculate_extraction_duration = calculate_extraction_duration
fasttext_model, word2vec_model, sentence_bert_model = load_word_embeddings(enabled_models)
global_func.fasttext_model = fasttext_model
global_func.word2vec_model = word2vec_model
global_func.sentence_bert_model = sentence_bert_model

conf_similarity = {"enabled": {}}
for key in enabled_models.keys():
  if enabled_models[key][0]:
    conf_similarity["enabled"][key] = enabled_models[key][1]
    if key == "fasttext":
      conf_similarity[key] = {"model": fasttext_model, "phrase_similarity": fasttext_model.get_sentence_vector}
    if key == "word2vec":
      conf_similarity[key] = {"model": word2vec_model, "phrase_similarity": word2vec_model.get_mean_vector}
    if key == "sentence_bert":
      conf_similarity[key] = {"model": sentence_bert_model}

word_similarity = partial(compare_word_similarity, conf_similarity)
global_func.entity_similarity = word_similarity
global_func.problem_mapping_similarity = word_collection_similarity
global_func.majority_vote = get_majority_vote
global_func.majority_vote_vs_collections = get_majority_vote_vs_collections
global_func.majority_vote_vs_collections_many = get_majority_vote_vs_collections_many
global_func.question_similarity = partial(compare_question_similarity, sentence_bert_model)
global_func.extract_part_from_text = partial(extract_most_relevant_text_part, sentence_bert_model)
global_func.extract_part_from_text_collection = extract_most_relevant_text_part_from_collection
global_func.most_similar_problems = most_similar_problems