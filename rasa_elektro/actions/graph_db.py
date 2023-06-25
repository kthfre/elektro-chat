from neo4j import GraphDatabase
import copy
import numpy as np

class GraphDBHandler:
    def __init__(self, uri="bolt://localhost:7687", user="neo4j", password="neo4j"):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def _problem_exists(self, tx, problem_id):
      result = tx.run(
        "MATCH (p:Problem {id: $id}) WITH count(p) > 0 AS node_exists RETURN node_exists",
        id=problem_id
      )
      
      records = list(result)

      return records[0]["node_exists"]

    def _is_multianswer(self, tx, problem_id):
      result = tx.run(
        "MATCH (p:Problem {id: $id})-[r]->(b) RETURN EXISTS((p)-[]-(b:MultiAnswer)) AS is_multianswer",
        id=problem_id
      )

      records = list(result)

      return records[0]["is_multianswer"]

    def _match_and_return_multianswer_problem(self, tx, problem_id):
      result = tx.run(
        "MATCH path = (n:Problem {id: $id})-[r*]->(b:Reading|Hint|Solution|StepId|Knowledge) \
         WITH collect(path) AS paths \
         CALL apoc.convert.toTree(paths, false) \
         YIELD value AS problem \
         RETURN problem",
        id=problem_id)

      records = list(result)

      summary = result.consume()

      return records, summary

    def _match_and_return_module_theory(self, tx):
      result = tx.run(
        "MATCH path = (n:Module)-[:hasTheory]->(b:Theory) \
         WITH collect(path) AS paths \
         CALL apoc.convert.toTree(paths, false) \
         YIELD value AS theory \
         RETURN theory")

      records = list(result)

      summary = result.consume()

      return records, summary

    def _get_all_problems(self, tx):
      result = tx.run(
        "MATCH (p:Problem) return p"
      )
      
      records = list(result)

      return records

    def get_all_theory(self):
      with self.driver.session(database="neo4j") as session:
        result, summary = session.execute_read(self._match_and_return_module_theory)

      return result, summary

    def problem_exists(self, problem_id):
      with self.driver.session(database="neo4j") as session:
        result = session.execute_read(self._problem_exists, problem_id=problem_id)

      return result

    def is_multianswer(self, problem_id):
      with self.driver.session(database="neo4j") as session:
        result = session.execute_read(self._is_multianswer, problem_id=problem_id)

      return result

    def get_problem(self, problem_id):
      with self.driver.session(database="neo4j") as session:
        records, summary = session.execute_read(self._match_and_return_multianswer_problem, problem_id=problem_id)

      return records, summary

    def get_all_problems(self):
      with self.driver.session(database="neo4j") as session:
        records = session.execute_read(self._get_all_problems)

      return records

class TheoryHandler:
    def __init__(self, theory=None):
      self.theory_cache = theory
      self.theory_map = {}
      self.modules = None
      self.texts_per_module = None
      self.chosen_module = None
      self.question = None
      self.first_question = True
      self.duration = None

    def store_theory(self, theory):
      if len(theory) == 1 and len(theory[0]["theory"].keys()) == 0:
        return

      self.theory_cache = theory

      if len(self.theory_map.keys()) > 0:
        self.theory_map = {}

      for record in self.theory_cache:
        module_name = record["theory"]["name"]
        self.theory_map[module_name] = {"title": [], "text": []}

        for content in record["theory"]["hasTheory"]:
          self.theory_map[module_name]["title"].append(content["title"])
          self.theory_map[module_name]["text"].append(content["text"])

    def set_num_modules_and_texts(self, modules, texts_per_module):
      self.modules = modules
      self.texts_per_module = texts_per_module

    def set_chosen_module(self, name):
      self.chosen_module = name

    def set_question(self, question):
      self.question = question

    def set_duration(self, duration):
      self.duration = duration

class QueryTreeHandler:
    def __init__(self, query_tree=None):
      self.tree = query_tree
      self.question_map = None
      self.response_map = None
      self.question_path = None
      self.maps_to = None
      self.step_tree = None
      self.all_steps = None
      self.unique_steps = None
      self.unique_steps_map = None
      self.unique_topics = None
      self.node_ids = None
      self.original_tree = None
      self.original_step_tree = None
      self.step_num = None
      self.total_steps = None
      self.step_history = []
      self.step_tree_update_trigger = None
      self.problem_type = None
      self.num_steps = None

    # stores entire problem tree and a copy of the original
    def set_tree(self, tree):
      self.tree = tree
      
      if self.original_tree is None:
        self.original_tree = copy.deepcopy(tree)

    # sets problem type
    def set_problem_type(self, problem_type):
      self.problem_type = problem_type

    # stores original question/response for multianswer problems and creates a copy of question map for traversal
    def set_multianswer_paths(self, question_map, response_map):
      self.question_map = question_map
      self.response_map = response_map
      self.question_path = copy.deepcopy(question_map)

    # stores tree, collection and mappings of the steps in advanced potentially multipath problems as well as a copy of the original step tree
    def set_advanced_multipaths(self, step_tree, all_steps, unique_steps, unique_steps_map, unique_topics):
      self.step_tree = step_tree
      self.all_steps = all_steps
      self.unique_steps = unique_steps
      self.unique_steps_map = unique_steps_map
      self.unique_topcs = unique_topics

      if self.original_step_tree is None:
        self.original_step_tree = copy.deepcopy(self.step_tree)

      if self.step_num is None:
        self.step_num = 1

    # resets for advanced problems the step tree as well as the count of steps
    def reset_advanced_multipaths(self):
      self.step_tree = copy.deepcopy(self.original_step_tree)
      self.step_num = 1

    # updates for multianswer problems the question path to be traversed of the multianswer mapping
    def update_question_path(self, problem_answer):
      if " " not in problem_answer:
        self.question_path = self.question_path[problem_answer]
      else:
        if problem_answer in self.question_path.keys():
          self.question_path = self.question_path[problem_answer]
        else:
          problem_answer_combined = "_".join(problem_answer.split(" "))
          self.question_path = self.question_path[problem_answer_combined]

    # updates advanced (whole problem traversal) step tree path based on chosen path (id)
    def update_advanced_tree_path(self, node_id, trigger):
      self.step_tree = self.step_tree[node_id]["next_step"]
      self.step_tree_update_trigger = trigger

    # reset question path for multianswer problem mapping
    def reset_question_path(self):
      self.question_path = copy.deepcopy(self.question_map)

    # set problem multianswer problem maps to
    def set_multianswer_mapping(self, maps_to):
      self.maps_to = maps_to

    # has problem tree?
    def has_tree(self):
      return False if self.tree is None else True

    # has multianswer path?
    def has_multianswer_paths(self):
      return False if self.question_map is None or self.response_map is None else True

    # has multianswer problem been mapped to a problem?
    def has_multianswer_mapping(self):
      return False if self.maps_to is None else True

    # set node ids for advanced problem either all available for part of problem or chosen for stepthrough entire problem
    def set_advanced_nodeids(self, ids):
      self.node_ids = list(ids)

    # has node ids set?
    def has_nodeids(self):
      return False if self.node_ids is None else True

    def increment_step(self):
      if self.step_num is None:
        self.step_num = 1
      else:
        self.step_num += 1

    def calculate_num_steps(self):
      steps = 1
      step_tree = self.step_tree
      nodes = list(step_tree.keys())

      while not step_tree[nodes[0]]["is_final"]:
        steps += 1
        step_tree = step_tree[nodes[0]]["next_step"]
        nodes = list(step_tree.keys())

      self.num_steps = steps

    # update estimated (not definitive depending on user chosen path, but estimates shortest possible path) path
    def update_estimated_steps(self, last_step=None):
      if last_step is not None:
        self.step_history.append(last_step)
      steps_taken = len(self.step_history)
      current_pos = self.step_tree

      def traverse(tree, current_length, cache):
        for node in tree.keys():
          if tree[node]["is_final"]:
            cache.append(current_length)
          else:
            traverse(tree[node]["next_step"], current_length + 1, cache)

      cache = []
      traverse(current_pos, steps_taken + 1, cache)

      self.total_steps = np.min(cache)

    def _extract(self, path=[], keys=[]):
      data = {}
      obj = self.tree

      for p in path:
        if type(obj) is dict and p in obj.keys():
          obj = obj[p]
        elif type(obj) is list:
          obj = obj[p]
        else:
          return {}

      if len(keys) and type(obj) is dict:
        for key in keys:
          if key in obj.keys():
            data[key] = obj[key]

        return data

      return obj

    def _filter_shallow(self, obj, keys=[]):
      if type(obj) is not dict or not len(keys):
        return obj

      data = {}

      for key in keys:
          if key in record.keys():
            data.append({key: obj[key]})

      return data

    def _filter_multiple(self, obj, keys=[]):
      if type(obj) is not list or not len(keys):
        return obj

      data = []

      for record in obj:
        for key in keys:
          if type(record) is not dict:
            return obj

          if key in record.keys():
            data.append({key: record[key]})

      return data

    def _extend_relations(self, relations=[], extensions={}):
      if len(relations) == 0 or len(extensions.keys()) == 0:
        return relations

      combined_relations = []

      for relation in relations:
        if relation in extensions.keys():
          for extension in extensions[relation]:
            combined_relations.append(relation + "." + extension)

      return combined_relations

    # arr - collection of trees to traverse, relations - of format {relations: [rel1, rel2], extensions: {"rel1": ["ans", "answer"]}}, 
    # key_utterance - string key in form of question utterance, key_response - string key in form of user responses to traverse on, terminal - terminal node name, and id to map {terminal: "StepId", key: "id"}
    # note: assumes one and only relation keyword path per level and will silently ignore additional ones and fail if none is present
    def _traverse_on_collection_extract_map_dfs(self, arr, key_map, relations, terminal):
      def traverse(o, new_obj, conf):
        if o["_type"] in conf["terminal"]["terminal"]:
          node_name = o["_type"].lower()
          if node_name in conf["terminal"]["key"].keys():
            for prop in conf["terminal"]["key"][node_name].keys():
              new_obj[conf["terminal"]["key"][node_name][prop]] = o[prop]
        else:           
          for rel in conf["relations"]:
            if rel in o.keys():
              for child in o[rel]:
                traverse(child, new_obj, conf)

      tree = {}
      conf = {"relations": relations["relations"], "terminal": terminal}

      for item in arr:
        key = item[key_map]
        tree[key] = {}
        traverse(item, tree[key], conf)

      return tree

    # obj - tree to traverse, relations - of format {relations: [rel1, rel2], extensions: {"rel1": ["ans", "answer"]}}, 
    # key_utterance - string key in form of question utterance, key_response - string key in form of user responses to traverse on, terminal - terminal node name, and id to map {terminal: "StepId", key: "id"}
    # note: assumes one and only relation keyword path per level and will silently ignore additional ones and fail if none is present
    def _traverse_on_key_map_dfs(self, obj, key_utterance, key_response, relations, terminal):
      def traverse(o, new_obj, conf):
        if o["_type"] == conf["terminal"]["terminal"]:
          new_obj["maps_to"] = o[conf["terminal"]["key"]]
        else:
          for u in conf["utter"]:
            if u in o.keys():
              utter = u
              break

          for r in conf["response"]:
            if r in o.keys():
              response = r
              break

          new_obj["utterance"] = o[utter]
          new_obj["responses"] = list(o[response])
            
          for rel in conf["relations"]["relations"]:
            if rel in o.keys():
              for relc in conf["relations"]["combined"]:
                if rel in relc and relc in o[rel][0].keys():
                  rel_c = relc
                  break

              for child in o[rel]:
                new_obj[child[rel_c]] = {}
                traverse(child, new_obj[child[rel_c]], conf)

      tree = {}
      combined_relations = self._extend_relations(relations["relations"], relations["extensions"])
      conf = {"utter": key_utterance, "response": key_response, "relations": {"relations": relations["relations"], "combined": combined_relations}, "terminal": terminal}

      traverse(obj, tree, conf)

      return tree

    def _traverse_on_collection_multipath_extract_combined_map_dfs(self, obj, include, terminal):
      def traverse(tree_collection, include, terminal, new_tree, cache):
        for i, node in enumerate(tree_collection):
          node_id = node["_id"]

          if node_id not in cache.keys():
            new_tree[node_id] = {}

            for key in include["default"].keys():
              map_from = key.split(".")

              if map_from[0] not in node.keys():
                continue

              map_to = include["default"][key].split(".")

              if len(map_from) == 2:
                map_val = list(node[map_from[0]][0][map_from[1]]) if type(node[map_from[0]][0][map_from[1]]) is list else node[map_from[0]][0][map_from[1]]
              else:
                map_val = list(node[map_from[0]]) if type(node[map_from[0]]) is list else node[map_from[0]]

              if len(map_to) == 2:
                if map_to[0] not in new_tree[node_id]:
                  new_tree[node_id][map_to[0]] = {}
                new_tree[node_id][map_to[0]][map_to[1]] = map_val
              else:
                new_tree[node_id][map_to[0]] = map_val

            cache[node_id] = new_tree[node_id]

            if terminal["terminal"]["key"] not in node.keys():
              new_tree[node_id]["next_step"] = {}
              new_tree[node_id]["is_final"] = False
            else:
              new_tree[node_id]["is_final"] = True
          else:
            for key in include["force"].keys():
              if key not in cache[node_id].keys():
                map_from = key.split(".")

                if map_from[0] not in node.keys():
                  continue

                map_to = include["force"][key].split(".")
                
                if len(map_from) == 2:
                  map_val = list(node[map_from[0]][0][map_from[1]]) if type(node[map_from[0]][0][map_from[1]]) is list else node[map_from[0]][0][map_from[1]]
                else:
                  map_val = list(node[map_from[0]]) if type(node[map_from[0]]) is list else node[map_from[0]]

                if len(map_to) == 2:
                  if map_to[0] not in cache[node_id]:
                    cache[node_id][map_to[0]] = {}
                  cache[node_id][map_to[0]][map_to[1]] = map_val
                else:
                  cache[node_id][map_to[0]] = map_val

            new_tree[node_id] = cache[node_id]

          if terminal["terminal"]["key"] not in node.keys():
            traverse(node["hasStep"], include, terminal, new_tree[node_id]["next_step"], cache)

      if type(obj) == dict:
        obj = [obj]

      tree = {}
      cache = {}
      traverse(obj, include, terminal, tree, cache)

      return tree, cache

    def _flatten_tree_remove_child_on_key(self, obj, key):
      obj_flat = copy.deepcopy(obj)
      for k in obj_flat.keys():
        if key in obj_flat[k].keys():
          del obj_flat[k][key]

      return obj_flat

    def _extract_unique_on_key_reverse_map(self, obj, key):
      unique_map = {}
      unique = []

      for k in obj.keys():
        if obj[k][key] in unique:
          unique_map[str(obj[k][key])].append(k)
        else:
          unique_map[str(obj[k][key])] = [k]
          unique.append(list(obj[k][key]))

      return unique, unique_map

    def _extract_tree_from_multianswer(self):
      problem_collection = self.tree["problem"]["isType"][0]["isMappedTo"]

      for problem in problem_collection:

        if problem["id"] == self.maps_to:
          return problem

    # builds maps/paths for multianswer problems,
    # returns question map and response map
    def build_map(self):
      obj = self._extract(["problem", "isType", 0, "hasObject", 0])
      obj = self._filter_multiple(obj, ["question", "answers"])


      problem_map_object = self.tree["problem"]["isType"][0]["hasObject"][0]
      problem_steps = self.tree["problem"]["isType"][0]["isMappedTo"]

      question_map = self._traverse_on_key_map_dfs(problem_map_object, ["question"], ["answers"], 
        {"relations": ["hasObject", "mapsTo"], "extensions": {"hasObject": ["answer"], "mapsTo": ["answer"]}}, 
        {"terminal": "StepId", "key": "id"})
      response_map = self._traverse_on_collection_extract_map_dfs(problem_steps, "id", {"relations": ["hasReading", "hasHint", "hasSolution"]}, 
        {"terminal": ["Reading", "Hint", "Solution"], "key": {"reading": {"book": "book", "section": "section"}, "hint": {"text": "hint"}}})

      return question_map, response_map

    def merge_extract_multipath_multistep_map(self):
      if self.problem_type == "single":
        problem_step_tree = self.tree["problem"]["isType"][0]["hasStep"]
      elif self.problem_type == "multi":
        problem_step_tree = self._extract_tree_from_multianswer()

      tree, cache = self._traverse_on_collection_multipath_extract_combined_map_dfs(problem_step_tree, 
        {"default": {"keywords": "keywords", "text": "description", "hasHint.text": "hint", "hasReading.book": "reading.book", "hasReading.section": "reading.section", "hasKnowledge.questions": "knowledge.questions", "hasKnowledge.answers": "knowledge.answers", "hasKnowledge.text": "knowledge.output"}, 
        "force": {"keywords": "keywords", "text": "description", "hasHint.text": "hint", "hasReading.book": "reading.book", "hasReading.section": "reading.section", "hasKnowledge.questions": "knowledge.questions", "hasKnowledge.answers": "knowledge.answers", "hasKnowledge.text": "knowledge.output"}}, {"terminal": {"key": "hasSolution"}})  
      cache_flat = self._flatten_tree_remove_child_on_key(cache, "next_step")
      unique_steps, unique_steps_map = self._extract_unique_on_key_reverse_map(cache_flat, "keywords")
      unique_topics = [t[0] for t in unique_steps] if len(unique_steps[0]) else []

      return tree, cache_flat, unique_steps, unique_steps_map, unique_topics