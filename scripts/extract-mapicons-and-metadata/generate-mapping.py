#!python

# This script extracts the map icons and the mapping of unit type to map icon
# from a DCS: World installation.

# Requires ImageMagick to be in the PATH.

import re
import os.path
import json
import subprocess

DCS_PATH=r"D:\Program Files\Eagle Dynamics\DCS World"
DB_PATH=os.path.join(DCS_PATH, r"Scripts\Database")
FOLDER_SET=["vehicles", "navy", "helicopters", "planes"]
RESULT_PATH=r"D:\data\dcs-mission-planner\repo\vendors\eagledynamics\mapicons"

unitdata = {}
classifiers = set()

for folder in FOLDER_SET:
	for (dirpath, dirnames, filenames) in os.walk(os.path.join(DB_PATH, folder)):
		if len(filenames):
			for filename in filter(lambda x: x.endswith(".lua"), filenames):
				with open(os.path.join(dirpath, filename), "r") as f:
					lua = f.read()
					if folder in ("planes", "helicopters"):
						name_match = re.findall(r'return '+folder[:-1]+'\( ?"([^"]+)"', lua)
					else:
						name_match = re.findall(r'GT.Name = "([^"]+)"', lua)
					displayname_match = re.findall(r'GT.DisplayName = _\("([^"]+)"', lua)
					mapclasskey_match = re.findall(r'mapclasskey = "([^"]+)"', lua)
					
					if name_match and mapclasskey_match:
						name = name_match[-1]
						mapclasskey = mapclasskey_match[-1]
						displayname = (displayname_match[-1] if displayname_match else "")
						
						unitdata[name] = {'mapclasskey':mapclasskey,
										  'display_name': displayname,
										  }
						classifiers.add(mapclasskey)

for (name, data) in unitdata.items():
	mapclasskey = data["mapclasskey"]
	withoutp = mapclasskey[1:]
	imgbasename = "P%d" % int(withoutp) # remove leading zero
	data["iconbasename"] = imgbasename
	imagefilename = os.path.join(DCS_PATH, r"MissionEditor\data\NewMap\images\themes\nato", imgbasename)+".png"
	redresultfilename = os.path.join(RESULT_PATH, imgbasename)+"_red.png"
	blueresultfilename = os.path.join(RESULT_PATH, imgbasename)+"_blue.png"
	
	p = subprocess.Popen(["composite", "red.png", "-channel", "RGB", "-compose", "multiply", imagefilename, redresultfilename])
	p.communicate()
	p = subprocess.Popen(["composite", "blue.png", "-channel", "RGB", "-compose", "multiply", imagefilename, blueresultfilename])
	p.communicate()

with open("unitdata.json", "w") as f:
	json.dump(unitdata, f)
