# This files contains your custom actions which can be used to run
# custom Python code.
#
# See this guide on how to implement these action:
# https://rasa.com/docs/rasa/custom-actions

from typing import Any, Text, Dict, List
import numpy as np

from rasa_sdk import Action, Tracker, FormValidationAction
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.types import DomainDict
from rasa_sdk.events import SlotSet, SessionStarted, ActionExecuted, EventType, ActiveLoop, UserUttered, FollowupAction, AllSlotsReset
from .util import global_func
from .graph_db import GraphDBHandler, QueryTreeHandler, TheoryHandler

class ActionSessionStart(Action):
    def name(self) -> Text:
        return "action_session_start"

    async def run(
      self, dispatcher, tracker: Tracker, domain: Dict[Text, Any]
    ) -> List[Dict[Text, Any]]:

        # the session should begin with a `session_started` event
        events = [SessionStarted()]

        dispatcher.utter_message(template="utter_custom_section", section="type")
        dispatcher.utter_message(template="utter_greet")

        # make sure all slots are reset
        events.append(AllSlotsReset())

        try:
            db_handler = GraphDBHandler()
            conf = {}
            conf["db"] = db_handler
            global_func.overwrite(conf, "db")         
        except Exception as e:
            dispatcher.utter_message("Tyvärr har vi tekniska problem, återkom senare tack!")

            return []

        # an `action_listen` should be added at the end as a user message follows
        events.append(ActionExecuted("action_listen"))

        return events

class ActionTheoryOrCompute(Action):

    def name(self) -> Text:
        return "action_theory_or_compute"

    def run(self, dispatcher: CollectingDispatcher,
          tracker: Tracker,
          domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        conf = global_func.db
        theory = conf.db.get_all_theory()
        conf.theory = TheoryHandler()
        conf.theory.store_theory(theory[0])
        theory = theory[0]
        global_func.overwrite(conf, "db")
        db = global_func.db

        latest_msg = tracker.latest_message["text"]
        theory_keywords = ["teori", "bok", "läsa", "text"]
        problem_keywords = ["problem", "uppgift", "beräkna", "räkna"]

        similarities_theory = global_func.entity_similarity(latest_msg, theory_keywords, exclude_models = ["fasttext", "word2vec", "spacy"])
        similarities_problem = global_func.entity_similarity(latest_msg, problem_keywords, exclude_models = ["fasttext", "word2vec", "spacy"])
        index_max, index_mean, max_agree, mean_agree, max_above_thres, mean_above_thres = global_func.majority_vote_vs_collections(similarities_theory, similarities_problem)
        events = []

        if index_max == 0:
            modules = []
            texts_per_module = []

            if len(theory) == 1 and len(theory[0]["theory"].keys()) == 0:
                dispatcher.utter_message(response="utter_theory_know_none")
                dispatcher.utter_message(response="utter_goodbye")

                return [SlotSet("problem_stage", "eleven")]

            for modul in theory:
                modules.append(modul["theory"]["name"])
                texts_per_module.append(len(modul["theory"]["hasTheory"]))

            db.theory.set_num_modules_and_texts(modules, texts_per_module)
            modules_segment = global_func.list_to_comma_separated_segment(modules)

            dispatcher.utter_message(template="utter_custom_section", section="theory")
            dispatcher.utter_message(response="utter_theory_confirm")
            dispatcher.utter_message(response="utter_theory_subjects", subject=modules_segment)

            if len(db.theory.modules) == 1:
                dispatcher.utter_message(response="utter_theory_only_subject", subject=db.theory.modules[0])
                
                events = [FollowupAction("action_confirm_theory_subject")]
                problem_stage = "twenty"
            elif len(db.theory.modules) > 1:
                dispatcher.utter_message(response="utter_ask_theory_subject", num_subjects=str(len(db.theory.modules)))
                problem_stage = "twenty"
        else:
            dispatcher.utter_message(template="utter_custom_section", section="problem")
            dispatcher.utter_message(response="utter_problem_confirm")
            dispatcher.utter_message(response="utter_problem_ask_id")

            problem_stage = "one"
            next_action = "action_confirm_problemid"
            
        return [SlotSet("problem_stage", problem_stage)] + events

class ActionConfirmTheorySubject(Action):

    def name(self) -> Text:
        return "action_confirm_theory_subject"

    def run(self, dispatcher: CollectingDispatcher,
          tracker: Tracker,
          domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        db = global_func.db
        max_similarity = -2
        max_similarity_index = -1
        latest_msg = tracker.latest_message["text"]
        entity = tracker.latest_message["entities"][0] if len(tracker.latest_message["entities"]) > 0 else None

        if db.theory == None:
            dispatcher.utter_message(response="utter_theory_know_none")
            dispatcher.utter_message(response="utter_goodbye")

            return [SlotSet("problem_stage", "eleven")]

        if len(db.theory.modules) == 1:
            modul = db.theory.modules[0]

            if db.theory.first_question:
                num_texts = len(db.theory.theory_map[modul]["text"])
                dispatcher.utter_message(response="utter_theory_module_num_texts", num_texts=(str(num_texts)))
                duration = global_func.calculate_extraction_duration(db.theory.theory_map[modul]["text"])
                db.theory.set_duration(duration)
                dispatcher.utter_message(response="utter_theory_reading_takes_time", duration=str(duration))
                db.theory.set_chosen_module(modul)
            else:
                duration = db.theory.duration

            dispatcher.utter_message(response="utter_knowledge_go")

            return [SlotSet("problem_stage", "twentyone"), SlotSet("theory_search_eta", str(duration))]
        else:
            if db.theory.first_question:
                if entity is not None:
                    similarities = global_func.entity_similarity(entity["value"], db.theory.modules, exclude_models = ["fasttext", "word2vec", "spacy"])
                else:
                    similarities = global_func.entity_similarity(latest_msg, db.theory.modules, exclude_models = ["fasttext", "word2vec", "spacy"])

                majority_vote, mean_majority_vote, above_threshold = global_func.majority_vote(similarities, threshold=0.33)
                modul = db.theory.modules[majority_vote]
            else:
                modul = db.theory.chosen_module

            valid = True if (db.theory.first_question and above_threshold) or not db.theory.first_question else False

            if valid:
                if db.theory.first_question:
                    dispatcher.utter_message(response="utter_theory_module_confirm", module=modul)
                    num_texts = len(db.theory.theory_map[modul]["text"])
                    dispatcher.utter_message(response="utter_theory_module_num_texts", num_texts=(str(num_texts)))
                    duration = global_func.calculate_extraction_duration(db.theory.theory_map[modul]["text"])
                    db.theory.set_duration(duration)
                    dispatcher.utter_message(response="utter_theory_reading_takes_time", duration=str(duration))
                    db.theory.set_chosen_module(modul)
                else:
                    duration = db.theory.duration
                
                dispatcher.utter_message(response="utter_knowledge_go")
                
                return [SlotSet("problem_stage", "twentyone"), SlotSet("theory_search_eta", str(duration))]
            else:
                dispatcher.utter_message(response="utter_theory_module_dont_understand")

                return [SlotSet("problem_stage", "twenty")]

class ActionHandleTheory(Action):

    def name(self) -> Text:
        return "action_handle_theory"

    def run(self, dispatcher: CollectingDispatcher,
          tracker: Tracker,
          domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        db = global_func.db
        modul = db.theory.chosen_module
        latest_msg = tracker.latest_message["text"]
        intent = tracker.get_intent_of_latest_message()
        theory_trigger = tracker.get_slot("theory_trigger_control")
        eta = tracker.get_slot("theory_search_eta")
        
        if (intent == "inform_theory_question" or intent == "inform_problem_question") and not theory_trigger:
            dispatcher.utter_message(template="utter_custom_theorysearch", eta=eta)

            return [SlotSet("theory_trigger_control", True)]

        dispatcher.utter_message(template="utter_custom_theorysearch", eta="null")

        if modul is None:
            dispatcher.utter_message("Var god ange modul innan du ställer din förfrågan så jag lättare kan navigera bland mitt textmaterial.")
        else:
            db.theory.first_question = False
            texts = db.theory.theory_map[modul]["text"]
            text, max_similarity, max_similarity_index  = global_func.extract_part_from_text_collection(texts, latest_msg)
            title = db.theory.theory_map[modul]["title"][max_similarity_index]
            dispatcher.utter_message(response="utter_theory_here_is_text", text_name=title)
            dispatcher.utter_message(response="utter_theory_text", text=text)
            dispatcher.utter_message(response="utter_knowledge_continue")

        return [SlotSet("theory_trigger_control", False)]

class ActionConcludeTheory(Action):

    def name(self) -> Text:
        return "action_conclude_theory"

    def run(self, dispatcher: CollectingDispatcher,
          tracker: Tracker,
          domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(response="utter_hope_question_session_useful")

        return [SlotSet("problem_stage", "eleven")]

class ActionConfirmProblemid(Action):

    def name(self) -> Text:
        return "action_confirm_problemid"

    def run(self, dispatcher: CollectingDispatcher,
          tracker: Tracker,
          domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

      problem_id = tracker.get_slot("problem_id")

      if not problem_id:
        if len(tracker.latest_message["entities"]) > 0:
            problem_id = tracker.latest_message["entities"][0]["value"]
        else:
            dispatcher.utter_message(response="utter_cant_interpret_problemid")

            return []

      try:
        conf = global_func.db
        problem_exists = conf.db.problem_exists(problem_id)

        if problem_exists:
            records, summary = conf.db.get_problem(problem_id)
            dispatcher.utter_message(template="utter_custom_problemid", problem_id=problem_id)
            dispatcher.utter_message(response="utter_problem_recognize", problem_id=problem_id)
        else:
            problems = conf.db.get_all_problems()
            matches = global_func.most_similar_problems(problem_id, problems)

            if len(matches) > 0:
                problem_ids = global_func.list_to_comma_separated_segment(matches)
                dispatcher.utter_message(response="utter_problem_dont_exist_spelled_wrong", problem_id=problem_id)
                dispatcher.utter_message(response="utter_problem_dont_exist_suggest_similar", problem_ids=problem_ids)
            else:
                dispatcher.utter_message(response="utter_problem_dont_exist", problem_id=problem_id)

            return []

      except Exception as e:
        dispatcher.utter_message("Tyvärr har vi tekniska problem, återkom senare tack!")

        return []

      problem_tree = records[0].data()
      conf.query = QueryTreeHandler(problem_tree)
      global_func.overwrite(conf, "db")
      db = global_func.db
      problem_type = problem_tree["problem"]["isType"][0]["_type"]
      problem_difficulty = problem_tree["problem"]["difficulty"]
      prob_type = "single"

      if problem_type == "MultiAnswer":
        question_map, response_map = db.query.build_map()
        db.query.set_multianswer_paths(question_map, response_map)
        prob_type = "multi"
        next_action = "action_ask_multianswer"
        problem_stage = "two"

        dispatcher.utter_message(response="utter_inform_problem_mapping")
      else:
        next_action = "action_ask"
        problem_stage = "three"
    
      db.query.set_problem_type(prob_type)

      return [SlotSet("problem_difficulty", problem_difficulty), SlotSet("problem_stage", problem_stage), FollowupAction(next_action)]

class ActionAskEnoughHelp(Action):

    def name(self) -> Text:
        return "action_ask_enough_help"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        db = global_func.db
        problem_difficulty = tracker.get_slot("problem_difficulty")
        problem_advanced = tracker.get_slot("problem_advanced")
        dispatcher.utter_message(response="utter_ask_enough_help")

        events = []

        if problem_difficulty == "advanced":
            if problem_advanced == "whole":
                node_ids = db.query.node_ids

                if len(node_ids) == 1:
                    node_id = node_ids[0]
                    all_steps = db.query.all_steps

                    if "is_final" in all_steps[node_id].keys() and all_steps[node_id]["is_final"]:
                        if tracker.latest_action_name == "action_reading_advanced":
                            events.append(SlotSet("problem_final_step"), True)
                            events.append(FollowupAction("action_stepthrough_advanced"))
                    else:
                        if tracker.latest_action_name == "action_reading_advanced":
                            db.query.update_advanced_tree_path(node_id, self.name())
                            db.query.step_num += 1
            elif problem_advanced == "part":
                if tracker.latest_action_name == "action_reading_advanced":
                    events.append(FollowupAction("action_conclude_advanced"))

        return events

class ActionGoodUnderstand(Action):

    def name(self) -> Text:
        return "action_good_understand"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        db = global_func.db
        problem_advanced = tracker.get_slot("problem_advanced")
        problem_provided = tracker.get_slot("problem_provided")
        problem_difficulty = tracker.get_slot("problem_difficulty")
        problem_stage = tracker.get_slot("problem_stage")

        keyword = ""

        if problem_difficulty == "simple":
            # if problem_stage == "eight": needed? good understand always bye?
            dispatcher.utter_message(template="utter_custom_section", section="null")
            dispatcher.utter_message(response="utter_good_understand_simple")

            return [SlotSet("problem_stage", "eleven"), FollowupAction("utter_goodbye")]
        elif problem_difficulty == "advanced":
            if problem_advanced == "part":
                dispatcher.utter_message(template="utter_custom_section", section="null")
                dispatcher.utter_message(reponse="utter_good_understand_simple")

                return [SlotSet("problem_stage", "eleven"), FollowupAction("utter_goodbye")]
            elif problem_advanced == "whole":
                step_num = db.query.step_num
                num_steps = db.query.num_steps

                all_steps = db.query.all_steps
                node_id = db.query.node_ids[0]
                keyword = all_steps[node_id]["keywords"][0]
                
                dispatcher.utter_message(response="utter_good_understand_part_whole", part=keyword)

                if step_num < num_steps:
                    step_tree = db.query.step_tree
                    current_steps = list(step_tree.keys())
                    db.query.increment_step()
                    db.query.update_advanced_tree_path(current_steps[0], self.name())
                    
                    step_tree = db.query.step_tree
                    current_steps = list(step_tree.keys())
                    db.query.set_advanced_nodeids([current_steps[0]])

                    return [SlotSet("problem_stage", "four"), FollowupAction("action_stepthrough_advanced")]
                else:
                    dispatcher.utter_message(template="utter_custom_section", section="null")

                    return [SlotSet("problem_stage", "nine"), FollowupAction("action_conclude_advanced")]

                if "is_final" in all_steps[node_id].keys() and all_steps[node_id]["is_final"]:
                    return [SlotSet("problem_final_step", True), SlotSet("problem_reading", None), FollowupAction("action_stepthrough_advanced")]
                else:
                    if problem_advanced == "whole" and problem_provided == "hint":
                        db.query.update_advanced_tree_path(node_id, self.name())
                        db.query.step_num += 1

            return [SlotSet("problem_reading", None)]

class ActionAllKnow(Action):

    def name(self) -> Text:
        return "action_all_know"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        db = global_func.db
        keyword = ""
        description = ""
        problem_advanced = tracker.get_slot("problem_advanced")
        problem_difficulty = tracker.get_slot("problem_difficulty")
        problem_advanced = tracker.get_slot("problem_advanced")

        all_steps = db.query.all_steps
        nodes = db.query.node_ids
        node_id = nodes[0]

        if problem_difficulty == "simple":
            dispatcher.utter_message(template="utter_custom_section", section="null")
            dispatcher.utter_message(response="utter_all_know_simple")

            return [SlotSet("problem_stage", "eleven"), FollowupAction("utter_goodbye")]
        elif problem_difficulty == "advanced":
            if problem_advanced == "part":
                dispatcher.utter_message(template="utter_custom_section", section="null")
                dispatcher.utter_message(response="utter_all_know_simple")

                return [SlotSet("problem_stage", "eleven"), FollowupAction("utter_goodbye")]
            elif problem_advanced == "whole":
                step_num = db.query.step_num
                num_steps = db.query.num_steps
                all_steps = db.query.all_steps
                node_id = db.query.node_ids[0]
                keyword = all_steps[node_id]["keywords"][0]
                
                dispatcher.utter_message(response="utter_all_know_part_whole", part=keyword)

                if step_num < num_steps:
                    step_tree = db.query.step_tree
                    current_steps = list(step_tree.keys())
                    db.query.increment_step()
                    db.query.update_advanced_tree_path(current_steps[0], self.name())  
                    step_tree = db.query.step_tree
                    current_steps = list(step_tree.keys())
                    db.query.set_advanced_nodeids([current_steps[0]])

                    return [SlotSet("problem_stage", "four"), FollowupAction("action_stepthrough_advanced")]
                else:
                    dispatcher.utter_message(template="utter_custom_section", section="null")

                    return [SlotSet("problem_stage", "nine"), FollowupAction("action_conclude_advanced")]

            return []

class ActionAsk(Action):

    def name(self) -> Text:
        return "action_ask"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        db = global_func.db
        problem_difficulty = tracker.get_slot("problem_difficulty")

        if db.query.step_tree is None:
            step_tree, all_steps, unique_steps, unique_steps_map, unique_topics = db.query.merge_extract_multipath_multistep_map()
            db.query.set_advanced_multipaths(step_tree, all_steps, unique_steps, unique_steps_map, unique_topics)
            dispatcher.utter_message(template="utter_custom_problemadvanced", problem_advanced="ask", part="N/A", step_num="N/A", total_steps="N/A", topics=unique_topics)

            return [FollowupAction("action_ask")]
        else:
            step_tree = db.query.step_tree
            all_steps = db.query.all_steps
            unique_steps = db.query.unique_steps
            unique_steps_map = db.query.unique_steps_map
            unique_topics = db.query.unique_topics
        
        if problem_difficulty == "simple":
            dispatcher.utter_message(response="utter_problem_simple")
            problem_stage = "five"
            node_ids = unique_steps_map[str(unique_steps[0])]
            db.query.set_advanced_nodeids(node_ids)
        elif problem_difficulty == "advanced":
            dispatcher.utter_message(template="utter_custom_section", section="advanced")
            problem_stage = "four"
            dispatcher.utter_message(response="utter_advanced_problem")
            dispatcher.utter_message(response="utter_ask_part_or_whole")

        return [SlotSet("problem_stage", problem_stage)]

class ActionAskMultianswer(Action):

    def name(self) -> Text:
        return "action_ask_multianswer"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(template="utter_custom_section", section="multi")

        db = global_func.db
        path = db.query.question_path

        if "maps_to" in path.keys():
            db.query.set_multianswer_mapping(path["maps_to"])
            dispatcher.utter_message(template="utter_custom_multianswer", maps_to=path["maps_to"])
            problem_tree = db.query.tree
            next_action = "action_ask"

            events = [SlotSet("maps_to", "completed"), SlotSet("problem_stage", "three"), FollowupAction(next_action)]

            return events
        else:
            dispatcher.utter_message(path["utterance"])

        return []

class ActionHandleMultianswer(Action):

    def name(self) -> Text:
        return "action_handle_multianswer"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        latest_msg = str(tracker.latest_message["text"]) # use if entity not found?
        problem_answer = tracker.latest_message["entities"][0]["value"] if not len(tracker.latest_message["entities"]) == 0 else latest_msg
        confidence = tracker.latest_message["entities"][0]["confidence_entity"] if not len(tracker.latest_message["entities"]) == 0 else None

        db = global_func.db
        path = db.query.question_path

        if problem_answer in path.keys():
            dispatcher.utter_message(reponse="utter_interpret_absolute", answer=problem_answer)
            db.query.update_question_path(problem_answer)
        else:
            if len(tracker.latest_message["entities"]) == 0:
                exclude_models = ["fasttext", "word2vec", "spacy"]
            else:
                exclude_models = []
            
            similarities = global_func.entity_similarity(problem_answer, path["responses"], exclude_models)
            majority_vote, mean_majority_vote, above_threshold = global_func.majority_vote(similarities, threshold=0.33)

            if not above_threshold:
                dispatcher.utter_message(response="utter_dont_understand")

                return [FollowupAction("action_ask_multianswer")]

            most_similar = path["responses"][majority_vote]
            dispatcher.utter_message(response="utter_interpret_as", answer=most_similar)
            db.query.update_question_path(most_similar)

        return [FollowupAction("action_ask_multianswer")]

class ActionStepThroughAdvanced(Action):

    def name(self) -> Text:
        return "action_stepthrough_advanced"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        maps_to = tracker.get_slot("maps_to")

        db = global_func.db
        step_tree = db.query.step_tree
        all_steps = db.query.all_steps
        current_steps = list(step_tree.keys())
        problem_stepthrough_first = tracker.get_slot("problem_stepthrough_first")

        is_mapped = tracker.get_slot("problem_multistep_mapped")
        is_final_step = tracker.get_slot("problem_final_step")

        if problem_stepthrough_first:
            db.query.calculate_num_steps()
            num_steps = db.query.num_steps
            dispatcher.utter_message(response="utter_confirm_whole_problem", num_steps=num_steps)
            db.query.set_advanced_nodeids(current_steps)
            step_num = db.query.step_num
            num_steps = db.query.num_steps
            num_solutions = len(current_steps)
            keyword = all_steps[current_steps[0]]["keywords"][0]

            dispatcher.utter_message(template="utter_custom_problemadvanced", problem_advanced="whole", part="N/A", step_num=str(step_num), total_steps=str(num_steps), topics="N/A")
            dispatcher.utter_message(response="utter_part_whole_solutions", step_num=str(step_num), num_steps=str(num_steps), num_solutions=str(num_solutions), keyword=keyword)

            return [SlotSet("problem_stepthrough_first", False), SlotSet("problem_stage", "five"), SlotSet("problem_advanced", "whole"), FollowupAction("action_hint")]
        else:
            step_num = db.query.step_num
            num_steps = db.query.num_steps
            num_solutions = len(current_steps)
            keyword = all_steps[current_steps[0]]["keywords"][0]

            dispatcher.utter_message(template="utter_custom_problemadvanced", problem_advanced="whole", part="N/A", step_num=str(step_num), total_steps=str(num_steps), topics="N/A")
            dispatcher.utter_message(response="utter_part_whole_solutions", step_num=str(step_num), num_steps=str(num_steps), num_solutions=str(num_solutions), keyword=keyword)

            return [SlotSet("problem_stage", "five"), FollowupAction("action_hint")]

        if is_final_step:
            return [SlotSet("problem_provided", None), FollowupAction("action_conclude_advanced")]

        if is_mapped is None or is_mapped == "nn":
            keyword = all_steps[current_steps[0]]["keywords"][0]
            step_num = db.query.step_num
            num_steps = db.query.num_steps
            num_solutions = len(current_steps)
            keyword = all_steps[current_steps[0]]["keywords"][0]

            dispatcher.utter_message(template="utter_custom_problemadvanced", problem_advanced="whole", part="N/A", step_num=str(step_num), total_steps=str(num_steps), topics="N/A")
            dispatcher.utter_message(response="utter_part_whole_solutions", step_num=str(step_num), num_steps=str(num_steps), num_solutions=str(num_solutions), keyword=keyword)

        events = []

        db.query.update_estimated_steps()
        dispatcher.utter_message(template="utter_custom_problemadvanced", problem_advanced="whole", part="N/A", step_num=str(db.query.step_num), total_steps=str(db.query.total_steps), topics="N/A")
        problem_advanced = tracker.get_slot("problem_advanced")

        if problem_advanced != "whole":
            events.append(SlotSet("problem_advanced", "whole"))

        return events

class ActionPartAdvanced(Action):

    def name(self) -> Text:
        return "action_part_advanced"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        db = global_func.db
        unique_steps = db.query.unique_steps
        unique_steps_map = db.query.unique_steps_map
        all_steps = db.query.all_steps

        if len(tracker.latest_message["entities"]) == 0:
            latest_msg = tracker.latest_message["text"]
            keywords_all = []

            for step in all_steps:
                keywords_all.append(all_steps[step]["keywords"])

            similarities = []
            for keywords in keywords_all:
                similarity = global_func.entity_similarity(latest_msg, keywords, exclude_models = ["fasttext", "word2vec", "spacy"]) 
                similarities.append(similarity)

            index_max, index_mean, max_agrees, mean_agrees, max_above_threshold, mean_above_threshold = global_func.majority_vote_vs_collections_many(similarities)

            if max_above_threshold:
                problem_part = keywords_all[index_max][0]
                dispatcher.utter_message(response="utter_confirm_problem_part", part=problem_part)
                node_ids = unique_steps_map[str(unique_steps[index_max])]
                db.query.set_advanced_nodeids(node_ids)
            else:
                dispatcher.utter_message(template="utter_custom_problemadvanced", problem_advanced="part", part="N/A", step_num="N/A", total_steps="N/A", topics="N/A")
                dispatcher.utter_message(response="utter_not_sure_part")
                
                return []
        else:
            problem_part = tracker.latest_message["entities"][0]["value"]
            confidence = tracker.latest_message["entities"][0]["confidence_entity"]

            index_max, index_mean = global_func.problem_mapping_similarity(problem_part, unique_steps)
            node_ids = unique_steps_map[str(unique_steps[index_max])]
            db.query.set_advanced_nodeids(node_ids)
            problem_part = all_steps[node_ids[0]]["keywords"][0]

            dispatcher.utter_message(response="utter_confirm_problem_part", part=problem_part)

        events = [SlotSet("problem_stage", "five"), SlotSet("problem_advanced", "part"), SlotSet("problem_part", problem_part), FollowupAction("action_hint")]

        dispatcher.utter_message(template="utter_custom_problemadvanced", problem_advanced="part", part=problem_part, step_num="N/A", total_steps="N/A", topics="N/A")

        return events

class ActionAskKnowledge(Action):

    def name(self) -> Text:
        return "action_ask_knowledge"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(template="utter_custom_section", section="knowledge")
        intent = tracker.get_intent_of_latest_message()
        problem_knowledge_first = tracker.get_slot("problem_knowledge_first")
        events = [SlotSet("problem_knowledge_loop", True)]

        if problem_knowledge_first:
            dispatcher.utter_message(response="utter_knowledge_first")
            events.append(SlotSet("problem_knowledge_first", False))
        else:
            dispatcher.utter_message(response="utter_knowledge_continue")

        return events

class ActionIntermediateKnowledge(Action):

    def name(self) -> Text:
        return "action_intermediate_knowledge"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        db = global_func.db
        question = tracker.get_slot("problem_knowledge_question")
        intent = tracker.get_intent_of_latest_message()
        latest_msg = tracker.latest_message["text"]
        problem_difficulty = tracker.get_slot("problem_difficulty")
        problem_advanced = tracker.get_slot("problem_advanced")

        if intent == "deny":
            all_steps = db.query.all_steps

            if problem_difficulty == "advanced" and problem_advanced == "part":
                problem_stage = "eight"
                node_ids = db.query.node_ids

                for i, node_id in enumerate(node_ids):
                    if "reading" in all_steps[node_id].keys():
                        problem_stage = "seven"
                        break
            else:
                node_id = db.query.node_ids[0]

                if "reading" in all_steps[node_id].keys():
                    problem_stage = "seven"
                else:
                    problem_stage = "eight"

            return [SlotSet("problem_stage", problem_stage), FollowupAction("action_ask_enough_help")]

        dispatcher.utter_message(response="utter_knowledge_go")
            
        return []

class ActionHandleKnowledge(Action):

    def name(self) -> Text:
        return "action_handle_knowledge"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        db = global_func.db
        intent = tracker.get_intent_of_latest_message()
        node_id = db.query.node_ids[0]
        all_steps = db.query.all_steps
        question = latest_msg = tracker.latest_message["text"]
        questions = all_steps[node_id]["knowledge"]["questions"]
        interpretations = all_steps[node_id]["knowledge"]["output"]
        answers = all_steps[node_id]["knowledge"]["answers"]

        if intent == "inform_part_problem" or intent == "inform_problem_answer" or intent == "inform_theory_compute" or intent == "inform_theory_question":
            dispatcher.utter_message(response="utter_not_sure_question_but_answer")

        if not (intent == "inform_problem_question" or intent == "inform_part_problem" or intent == "inform_problem_answer" or intent == "inform_theory_compute" or intent == "inform_theory_question"):
            dispatcher.utter_message(response="utter_cant_interpret_question")

        index_max = global_func.question_similarity(question, questions, ensemble=False)
        if index_max == -1:
            dispatcher.utter_message(response="utter_knowledge_dont_understand")
        else:
            output = interpretations[index_max]
            dispatcher.utter_message(response="utter_knowledge_interpret", interpretation=output)
            msg = answers[index_max]
            dispatcher.utter_message(msg)

        return [SlotSet("problem_knowledge_question", ""), FollowupAction("action_ask_knowledge")]


class ActionHint(Action):

    def name(self) -> Text:
        return "action_hint"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(template="utter_custom_section", section="hint")

        problem_advanced = tracker.get_slot("problem_advanced")
        problem_difficulty = tracker.get_slot("problem_difficulty")
        problem_reading = tracker.get_slot("problem_reading")
        problem_part = tracker.get_slot("problem_part")

        db = global_func.db

        node_ids = db.query.node_ids
        all_steps = db.query.all_steps
        node_id = node_ids[0]

        if problem_difficulty == "advanced":
            keyword = all_steps[node_id]["keywords"][0]

        events = []

        if problem_difficulty == "simple":
            dispatcher.utter_message(response="utter_hint_simple")
            hint = all_steps[node_id]["hint"]
            dispatcher.utter_message(hint)

            if "knowledge" in all_steps[node_id].keys():
                problem_stage = "six"
            elif "reading" in all_steps[node_id].keys():
                problem_stage = "seven"
            else:
                problem_stage = "eight"

            events.append(SlotSet("problem_stage", problem_stage))
        elif problem_difficulty == "advanced":
            if problem_advanced == "part":
                node_ids = db.query.node_ids
                dispatcher.utter_message(response="utter_hint_advanced_part", part=problem_part, num_solutions=str(len(node_ids)))

                for i, node_id in enumerate(node_ids):
                    dispatcher.utter_message(str(i + 1) + ". " + all_steps[node_id]["hint"])

                has_knowledge = False
                for i, node_id in enumerate(node_ids):
                    if "knowledge" in all_steps[node_id].keys():
                        has_knowledge = True
                        problem_stage = "six"
                
                has_reading = False
                if not has_knowledge:
                    for i, node_id in enumerate(node_ids):
                        if "reading" in all_steps[node_id].keys():
                            has_reading = True
                            problem_stage = "seven"

                if not has_knowledge and not has_reading:
                    problem_stage = "eight"

                events.append(SlotSet("problem_stage", problem_stage))

            elif problem_advanced == "whole":
                node_ids = db.query.node_ids
                node_id = node_ids[0]
                dispatcher.utter_message(response="utter_hint_advanced_whole")
                dispatcher.utter_message(all_steps[node_id]["hint"])

                has_knowledge = False
                if "knowledge" in all_steps[node_id].keys():
                    has_knowledge = True
                    problem_stage = "six"
                
                has_reading = False
                if not has_knowledge:
                    if "reading" in all_steps[node_id].keys():
                        has_reading = True
                        problem_stage = "seven"

                if not has_knowledge and not has_reading:
                    problem_stage = "eight"

                events.append(SlotSet("problem_stage", problem_stage))
        
        events += [SlotSet("problem_reading", problem_reading), SlotSet("problem_multistep", None), SlotSet("problem_multistep_mapped", None), SlotSet("problem_provided", "hint"), FollowupAction("action_ask_enough_help")]
        return events

class ActionReading(Action):

    def name(self) -> Text:
        return "action_reading"

    def run(self, dispatcher: CollectingDispatcher,
          tracker: Tracker,
          domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(template="utter_custom_section", section="reading")

        db = global_func.db

        node_ids = db.query.node_ids
        all_steps = db.query.all_steps
        problem_difficulty = tracker.get_slot("problem_difficulty")
        problem_advanced = tracker.get_slot("problem_advanced")

        if problem_difficulty == "simple":
            node_id = node_ids[0]
            book = all_steps[node_id]["reading"]["book"]
            section = all_steps[node_id]["reading"]["section"]

            dispatcher.utter_message(response="utter_reading_simple")
            dispatcher.utter_message(response="utter_reading_material", book=book, section=section)
            
            return [SlotSet("problem_stage", "eight"), FollowupAction("action_ask_enough_help")]
        elif problem_difficulty == "advanced":
            if problem_advanced == "part":
                dispatcher.utter_message(response="utter_reading_simple")
                all_steps = db.query.all_steps
                node_ids = db.query.node_ids

                for i, node_id in enumerate(node_ids):
                    keyword = all_steps[node_id]["keywords"][0]
                    book = all_steps[node_id]["reading"]["book"]
                    section = all_steps[node_id]["reading"]["section"]
                    dispatcher.utter_message(response="utter_reading_part", part=keyword, book=book, section=section)
            elif problem_advanced == "whole":
                dispatcher.utter_message(response="utter_reading_simple")
                all_steps = db.query.all_steps
                node_ids = db.query.node_ids
                node_id = node_ids[0]
                keyword = all_steps[node_id]["keywords"][0]
                book = all_steps[node_id]["reading"]["book"]
                section = all_steps[node_id]["reading"]["section"]
                dispatcher.utter_message(response="utter_reading_part", part=keyword, book=book, section=section)

        dispatcher.utter_message(response="utter_reading_hope_helps")

        return [SlotSet("problem_stage", "eight"), SlotSet("problem_provided", "reading")]

class ActionConcludeAdvanced(Action):

    def name(self) -> Text:
        return "action_conclude_advanced"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        db = global_func.db
        problem_advanced = tracker.get_slot("problem_advanced")
        events = []

        if problem_advanced == "whole":
            num_steps = db.query.num_steps

            dispatcher.utter_message(response="utter_conclude_whole", num_steps=str(num_steps))

            problem_stage = "eleven"
            events.append(SlotSet("problem_stage", problem_stage))

        return events
