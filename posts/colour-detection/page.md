---
title: Colour Detection
description: Implementation Details of Colour Detection Project
date: '2023-11-20'
tags:
    - Python
image: https://miro.medium.com/v2/resize:fit:786/format:webp/1*iYHkmrXnhEZZt-qv4S78JA.jpeg
draft: false
---

<script>
    import { ThemeToggle } from '$lib/components/site';
    import Katex from 'svelte-katex'
</script>


## Introduction
This article will take you through a **Color Recognition** task with **Python**. Basically, we are going to create a basic application that will help us detect color’s in an image. The program will let us return the RGB value, which is useful.

Many graphic designers and web designers will understand how useful RGB values can be. This is a great project to start with **Computer Vision**

## Color Recognition with Python using OpenCV
Firstly, if u never heard of computer vision, now is the best time to find out. Most of the areas of Machine Learning are closely related to computer vision.

Let’s import the libraries we need for this project to get started. I will use only three libraries for this - Pandas, Numpy and OpenCV:

```py
  import numpy as np
  import pandas as pd
  import cv2
```
First, we need to train our model to identify colors. To do this, we need data that includes the names of colors and values. Since most colors can be set using red, green, blue.

This is why we will be using the RGB formats as data points. I found a ready CSV file. I will give a download link at the end of the article

Now we will create 2 paths one for our test image and another for a CSV file

```py
img_path = 'pic2.jpg'
csv_path = 'colors.csv'
```

Let us read our image. What i meant is that to use our image for processing first our computer should read our image.For pc image is just a array of RGB values of pixels.

```py
# reading csv file
index = ['color', 'color_name', 'hex', 'R', 'G', 'B']
df = pd.read_csv(csv_path, names=index, header=None)
```
For our program to work properly, we need some global variables. You will know how global variables can be useful when working with functions:

```py
#declaring global variables
clicked = Falser = g = b = xpos = ypos = 0
```

## Color Recognition Function
The function below will be called when you will double-click on an area of ​​the image. It will return the name of the color

and the RGB values ​​for that color. This is where the magic happens:

```py
#function to calculate minimum distance from all colors and get the most matching color
def get_color_name(R,G,B): 
 minimum = 1000  
for i in range(len(df)):    
d = abs(R - int(df.loc[i,'R'])) + abs(G - int(df.loc[i,'G'])) + abs(B - int(df.loc[i,'B']))
# d is the minimum distance from our all color's and abs function return the absolute value.    
if d <= minimum: 
     minimum = d      
    cname = df.loc[i, 'color_name']  
return cname
```

##  Mouse Click Function
The function below is a helper function which is a part of our program which will help in the process of double click:

```py
#function to get x,y coordinates of mouse double click
def draw_function(event, x, y, flags, params):
  if event == cv2.EVENT_LBUTTONDBLCLK:   
 global b, g, r, xpos, ypos, clicked
    clicked = True
    xpos = x
    ypos = y
    b,g,r = img[y,x]
    b = int(b)    g = int(g)    r = int(r)
```
## Processing with Computer Vision

In this step, we’ll open the image in a new window using the OpenCV methods. And in this window, we will use the functions we defined earlier. The application is so simple that it returns the name of the color and the color values ​​when you double click on a certain area of ​​the image:

```py
# creating window
cv2.namedWindow('image')
cv2.setMouseCallback('image', draw_function)
while True:
  cv2.imshow('image', img)
  if clicked:
    #cv2.rectangle(image, startpoint, endpoint, color, thickness)-1 fills entire rectangle
    cv2.rectangle(img, (20,20), (600,60), (b,g,r), -1)
    #Creating text string to display( Color name and RGB values )
    text = get_color_name(r,g,b) + ' R=' + str(r) + ' G=' + str(g) + ' B=' + str(b)
    #cv2.putText(img,text,start,font(0-7),fontScale,color,thickness,lineType )
    cv2.putText(img, text, (50,50), 2,0.8, (255,255,255),2,cv2.LINE_AA)
    #For very light colours we will display text in black colour
      if r+g+b >=600:
       cv2.putText(img, text, (50,50), 2,0.8, (0,0,0),2,cv2.LINE_AA)
  if cv2.waitKey(20) & 0xFF == 27:
    break
cv2.destroyAllWindows()
```

## Output

![](https://im4.ezgif.com/tmp/ezgif-4-bb0036bba5.gif)
https://drive.google.com/file/d/1SYSGG01YLwJMZLECBb4CJQq1XNijyAvv/view

### Source Code 
```py {2} showLineNumbers title="color_detection.py"# pip install pandas opencv-python


import cv2
import pandas as pd

# --------------------------------------------------------------------------

img_path = 'pic2.jpg'
csv_path = 'colors.csv'

# reading csv file
index = ['color', 'color_name', 'hex', 'R', 'G', 'B']
df = pd.read_csv(csv_path, names=index, header=None)

# reading image
img = cv2.imread(img_path)
img = cv2.resize(img, (800,600))

#declaring global variables
clicked = False
r = g = b = xpos = ypos = 0

#function to calculate minimum distance from all colors and get the most matching color
def get_color_name(R,G,B):
	minimum = 1000
	for i in range(len(df)):
		d = abs(R - int(df.loc[i,'R'])) + abs(G - int(df.loc[i,'G'])) + abs(B - int(df.loc[i,'B']))
		if d <= minimum:
			minimum = d
			cname = df.loc[i, 'color_name']

	return cname

#function to get x,y coordinates of mouse double click
def draw_function(event, x, y, flags, params):
	if event == cv2.EVENT_LBUTTONDBLCLK:
		global b, g, r, xpos, ypos, clicked
		clicked = True
		xpos = x
		ypos = y
		b,g,r = img[y,x]
		b = int(b)
		g = int(g)
		r = int(r)

# creating window
cv2.namedWindow('image')
cv2.setMouseCallback('image', draw_function)

while True:
	cv2.imshow('image', img)
	if clicked:
		#cv2.rectangle(image, startpoint, endpoint, color, thickness)-1 fills entire rectangle 
		cv2.rectangle(img, (20,20), (600,60), (b,g,r), -1)

		#Creating text string to display( Color name and RGB values )
		text = get_color_name(r,g,b) + ' R=' + str(r) + ' G=' + str(g) + ' B=' + str(b)
		#cv2.putText(img,text,start,font(0-7),fontScale,color,thickness,lineType )
		cv2.putText(img, text, (50,50), 2,0.8, (255,255,255),2,cv2.LINE_AA)

		#For very light colours we will display text in black colour
		if r+g+b >=600:
			cv2.putText(img, text, (50,50), 2,0.8, (0,0,0),2,cv2.LINE_AA)

	if cv2.waitKey(20) & 0xFF == 27:
		break

cv2.destroyAllWindows()