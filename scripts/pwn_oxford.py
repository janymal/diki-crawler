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
url = "https://oxford.pwn.pl/index.php?module=lista&b=&lang=en&page={page_param}&limit=100"

def page_processor():
	while True:
		page_num = q.get()
		print("Processing page\"{pn}\"".format(pn=page_num))
		response = requests.get(url.format(page_param=page_num)).json()
		# print(response.status_code)
		print(response)
		if page_num == 1:
			for i in range(2, response["slider"]["Last"] + 1):
				q.put(i)
		words = [element["tytul"] + "\n" for element in response['data']]
		output_file.writelines(words)
		q.task_done()
		print("Finished page\"{pn}\"".format(pn=page_num))


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
	threading.Thread(target=page_processor, daemon=True).start()

q.put(1)
	
q.join()
finish_file()
