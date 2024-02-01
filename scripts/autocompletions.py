#!/usr/bin/env python3.11

from json import dumps
from string import ascii_lowercase
from time import sleep
import itertools
from queue import Queue, Empty
import requests
import signal
import threading

q = Queue()
url = "https://www.diki.pl/dictionary/autocomplete?q={q_param}&langpair=en::pl"

def keyword_processor():
	while True:
		keyword = q.get()
		print("Processing keyword \"{kw}\"".format(kw=keyword))
		response = requests.get(url.format(q_param = keyword))
		# print(response.status_code)
		response_json = [x + "\n" for x in response.json()]
		output_file.writelines(response_json)
		q.task_done()
		print("Finished keyword \"{kw}\"".format(kw=keyword))


# try:
# 	with open(".autocompletions_resume", "r") as resume_file:
# 		last_job = int(resume_file.read())
# except:
# 	last_job = 0

keywords = [''.join(x) for x in itertools.product(ascii_lowercase,repeat=3)] + [''.join(x) for x in itertools.product(ascii_lowercase,repeat=2)] 

output_file = open("words.txt", "a+")

def finish_file():
	output_file.seek(0)
	lines = output_file.readlines()
	lines_set = set(lines)
	lines = list(lines_set)
	lines.sort()
	output_file.writelines(lines)
	output_file.close()

def on_interupt(*args):
	print("Interrupting...")
	is_not_done = True
	
	while is_not_done:
		try:
			q.get(block=False)
			q.task_done()
			# print("successfuly removed task")
		except Empty:
			is_not_done = False
			# print("EXCEPTION!!!")
	print("Interrupted sucessfully!")

# 	with open(".autocompletions_resume", "w") as resume_file:
# 		resume_file.write(str(last_job))


signal.signal(signal.SIGINT, on_interupt)

for i in range(8):
	threading.Thread(target=keyword_processor, daemon=True).start()

for kw in keywords:
	q.put(kw)
	
q.join()
finish_file()
